const DATA_URL = new URL("../data/phase2-question-bank.json", import.meta.url);

const STRAND_WEIGHTS = {
  "Number Structure": 0.2,
  "Number Operations": 0.4,
  "Rational Numbers": 0.4
};
const PHASE_MIN_YEAR = 4;
const PRE_PHASE_LABEL = `Pre-Y${PHASE_MIN_YEAR} (Y3 question set)`;
const UI_STORAGE_KEY = "maths_snapshot_ui_v1";

const state = {
  bank: null,
  itemsById: new Map(),
  sectionsById: new Map(),
  session: null,
  notice: "",
  ui: {
    sidebar_collapsed: loadSidebarPreference(),
    show_history_panel: false,
    review_section_id: null
  }
};

const app = document.getElementById("app");

init();

async function init() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`Could not load question bank (${response.status})`);
    }
    const bank = await response.json();
    validateBankShape(bank);
    state.bank = bank;
    state.itemsById = new Map(bank.items.map((item) => [item.item_id, item]));
    state.sectionsById = new Map(bank.sections.map((section) => [section.section_id, section]));
    renderSetup();
  } catch (error) {
    renderError(error);
  }
}

function validateBankShape(bank) {
  if (!bank || !Array.isArray(bank.sections) || !Array.isArray(bank.items)) {
    throw new Error("Question bank shape is invalid.");
  }
}

function renderPage(contentHtml, options = {}) {
  const {
    headerContextHtml = "",
    activeStep = "setup",
    shellMode = "teacher",
    lockSidebar = false
  } = options;
  const hasHeaderContext = headerContextHtml.trim().length > 0;
  const shellNavItems = buildShellNavItems();
  const navItems = lockSidebar
    ? shellNavItems.map((item) => ({ ...item, enabled: item.key === activeStep }))
    : shellNavItems;
  const shellModeClass = shellMode === "student" ? "mode-student" : "mode-teacher";
  const collapsedClass = state.ui.sidebar_collapsed ? "sidebar-collapsed" : "";
  const activeStepTitle = {
    setup: "Session Setup",
    assessment: "Live Assessment",
    section: "Section Summary",
    probe: "Teacher Probe",
    results: "Teacher Report"
  }[activeStep] || "Maths Snapshots";

  app.innerHTML = `
    <div class="teacher-shell ${shellModeClass} ${collapsedClass}">
      <aside class="teacher-sidebar" aria-label="Teacher navigation">
        <div class="sidebar-brand">
          <span class="brand-mark" aria-hidden="true">${iconSvg("logo")}</span>
          <span class="brand-copy">
            <strong class="brand-title">Maths Snapshots</strong>
            <small class="brand-subtitle">Phase 2 Snapshot</small>
          </span>
        </div>

        <nav class="sidebar-nav">
          ${navItems
            .map((item) => `
              <button
                type="button"
                class="sidebar-link ${item.key === activeStep ? "is-active" : ""}"
                data-shell-nav="${item.key}"
                ${item.enabled ? "" : "disabled"}
                title="${escapeAttribute(item.description)}"
              >
                <span class="sidebar-link-icon" aria-hidden="true">${iconSvg(item.icon)}</span>
                <span class="sidebar-link-text">
                  <strong>${escapeHtml(item.label)}</strong>
                  <small>${escapeHtml(item.description)}</small>
                </span>
              </button>
            `)
            .join("")}
        </nav>
      </aside>

      <section class="teacher-main">
        <header class="app-topbar">
          <div class="topbar-left">
            <button type="button" id="sidebarToggleBtn" class="sidebar-toggle" aria-label="Toggle menu" aria-expanded="${state.ui.sidebar_collapsed ? "false" : "true"}">
              <span aria-hidden="true">${iconSvg("menu")}</span>
              <span class="sidebar-toggle-text">${state.ui.sidebar_collapsed ? "Expand" : "Collapse"}</span>
            </button>
            <div class="topbar-title-wrap">
              <strong class="topbar-title">${activeStepTitle}</strong>
              ${shellMode !== "student" ? `<small class="topbar-subtitle">Teacher-facing dashboard</small>` : ""}
            </div>
          </div>

          ${hasHeaderContext ? `<div class="topbar-right"><div class="nav-context">${headerContextHtml}</div></div>` : ""}
        </header>

        <main class="app-content">
          ${contentHtml}
        </main>
      </section>
    </div>
  `;

  bindShellActions();
}

function bindShellActions() {
  const sidebarToggle = document.getElementById("sidebarToggleBtn");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", onSidebarToggle);
  }

  const shellButtons = document.querySelectorAll("[data-shell-nav]");
  for (const button of shellButtons) {
    if (button.disabled) {
      continue;
    }
    button.addEventListener("click", onShellNavigate);
  }
}

function onSidebarToggle() {
  state.ui.sidebar_collapsed = !state.ui.sidebar_collapsed;
  saveSidebarPreference(state.ui.sidebar_collapsed);
  const shell = app.querySelector(".teacher-shell");
  if (!shell) {
    return;
  }
  shell.classList.toggle("sidebar-collapsed", state.ui.sidebar_collapsed);
  const toggle = document.getElementById("sidebarToggleBtn");
  const toggleText = toggle?.querySelector(".sidebar-toggle-text");
  if (toggle) {
    toggle.setAttribute("aria-expanded", state.ui.sidebar_collapsed ? "false" : "true");
  }
  if (toggleText) {
    toggleText.textContent = state.ui.sidebar_collapsed ? "Expand" : "Collapse";
  }
}

function onShellNavigate(event) {
  const target = event.currentTarget?.dataset?.shellNav;
  if (!target) {
    return;
  }

  if (target === "setup") {
    onNavHomeClick();
    return;
  }

  if (target === "assessment") {
    if (state.session?.current_attempt) {
      renderAssessment();
    }
    return;
  }

  if (target === "section") {
    const run = findReviewSectionRun();
    if (run) {
      renderSectionSummary(run);
    }
    return;
  }

  if (target === "probe") {
    const run = findNextProbeRun();
    if (run) {
      renderTeacherProbe(run);
    }
    return;
  }

  if (target === "results" && state.session?.generated_at) {
    renderResultsFromSession();
  }
}

function buildShellNavItems() {
  return [
    { key: "setup", label: "Setup", description: "Session options", enabled: true, icon: "setup" },
    { key: "assessment", label: "Assessment", description: "One question at a time", enabled: !!state.session?.current_attempt, icon: "assessment" },
    { key: "probe", label: "Teacher Probe", description: "Clarify ambiguous evidence", enabled: !!findNextProbeRun(), icon: "section" },
    { key: "results", label: "Teacher Report", description: "Session outcomes and PDF", enabled: !!state.session?.generated_at, icon: "results" }
  ];
}

function iconSvg(name) {
  const icons = {
    logo: `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 8h10M7 12h6M7 16h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
    home: `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M4 11.5L12 5l8 6.5V20H4z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 20v-5.5h5V20" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
    setup: `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 19c.9-3 3.3-4.7 6.5-4.7s5.6 1.7 6.5 4.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    assessment: `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><rect x="4" y="3.5" width="16" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    section: `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M5 5h14v14H5z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 9h8M8 13h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="17" r="1.2" fill="currentColor"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/><circle cx="15" cy="17" r="1.2" fill="currentColor"/></svg>`,
    results: `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M6 4h12v16H6z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
  };
  return icons[name] || icons.setup;
}

function findLatestSectionSummaryRun() {
  if (!state.session?.section_runs?.length) {
    return null;
  }
  const currentRun = state.session.section_runs[state.session.current_section_index];
  if (currentRun?.summary) {
    return currentRun;
  }
  for (let index = state.session.section_runs.length - 1; index >= 0; index -= 1) {
    const run = state.session.section_runs[index];
    if (run?.summary) {
      return run;
    }
  }
  return null;
}

function findReviewSectionRun() {
  if (!state.session?.section_runs?.length) {
    return null;
  }

  if (state.ui.review_section_id) {
    const matchingRun = state.session.section_runs.find(
      (run) => run.section_id === state.ui.review_section_id && run?.summary
    );
    if (matchingRun) {
      return matchingRun;
    }
  }

  return findLatestSectionSummaryRun();
}

function findCurrentProbeRun() {
  if (!state.session?.current_probe_section_id) {
    return null;
  }
  return state.session.section_runs.find((run) => run.section_id === state.session.current_probe_section_id) || null;
}

function findNextProbeRun() {
  if (!state.session?.section_runs?.length) {
    return null;
  }

  const currentRun = findCurrentProbeRun();
  if (currentRun) {
    return currentRun;
  }

  return state.session.section_runs.find((run) =>
    run.summary
    && run.diagnostic_summary?.teacher_probe_needed
    && run.teacher_probe?.status !== "completed"
  ) || null;
}

function setReviewSection(sectionId) {
  state.ui.review_section_id = sectionId || null;
}

function renderResultsFromSession() {
  if (!state.session) {
    renderSetup();
    return;
  }
  const sectionSummaries = state.session.section_runs
    .map((run) => run.summary)
    .filter(Boolean);

  const strandSummary = state.session.strand_summary?.length
    ? state.session.strand_summary
    : buildStrandSummary(sectionSummaries);
  const overallSummary = state.session.overall_summary
    || buildOverallSummary(strandSummary);

  state.session.strand_summary = strandSummary;
  state.session.overall_summary = overallSummary;
  renderResults(sectionSummaries, strandSummary, overallSummary);
}

function onNavHomeClick() {
  if (isSessionInProgress()) {
    saveCurrentQuestionResponse();
    const shouldLeave = window.confirm("Return to Home and discard this in-progress session?");
    if (!shouldLeave) {
      return;
    }
    clearSessionFromStorage();
  }
  state.session = null;
  state.notice = "";
  renderSetup();
}

function isSessionInProgress() {
  if (!state.session) {
    return false;
  }
  return !state.session.generated_at;
}

function renderError(error) {
  const content = `
    <section class="panel panel-error">
      <h1>Could not start app</h1>
      <p>${escapeHtml(error.message)}</p>
      <p>Run this app from a local server, for example:</p>
      <pre><code>python3 -m http.server 4173</code></pre>
      <p>Then open <code>http://localhost:4173</code> in your browser.</p>
    </section>
  `;
  renderPage(content, { homeEnabled: false, activeStep: "setup" });
}

function renderSetup() {
  const sections = getSortedSections();
  const savedSession = loadSessionFromStorage();
  const sessionHistory = loadSessionHistoryFromStorage();
  const resumeBanner = (savedSession && !savedSession.generated_at)
    ? `<div class="notice resume-notice">
        <strong>Resume?</strong> Session in progress for <strong>${escapeHtml(savedSession.student?.name || "a student")}</strong>.
        ${savedSession.last_saved_at ? `<span class="resume-meta">Last saved ${escapeHtml(formatSavedAt(savedSession.last_saved_at))}</span>` : ""}
        <span class="resume-actions">
          <button type="button" id="resumeSessionBtn" class="btn-resume">Resume session</button>
          <button type="button" id="discardSessionBtn" class="btn-discard-sm">Discard</button>
        </span>
      </div>`
    : "";
  const historyPanel = sessionHistory.length
    ? `<section class="device-history" aria-label="Saved reports on this device">
        <div class="device-history-head">
          <div>
            <strong>Saved reports on this device</strong>
            <p class="subtle">Expand only when needed. Clear this browser if students share the device.</p>
          </div>
          <div class="device-history-actions">
            <button type="button" id="toggleHistoryBtn">${state.ui.show_history_panel ? "Hide history" : `Show history (${sessionHistory.length})`}</button>
            <button type="button" id="clearHistoryBtn" class="btn-clear-results">Clear device history</button>
          </div>
        </div>
        ${state.ui.show_history_panel
          ? `<div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student</th>
                    <th>Teacher</th>
                    <th>Overall</th>
                    <th>Sections</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${sessionHistory
                    .map((entry) => `
                      <tr>
                        <td>${escapeHtml(formatSavedAt(entry.generated_at))}</td>
                        <td>
                          ${entry.student_name
                            ? escapeHtml(entry.student_name)
                            : `<input type="text" data-history-student="${escapeAttribute(entry.session_id)}" placeholder="Student name" value="" autocomplete="off" />`}
                        </td>
                        <td>
                          ${entry.teacher_name
                            ? escapeHtml(entry.teacher_name)
                            : `<input type="text" data-history-teacher="${escapeAttribute(entry.session_id)}" placeholder="Teacher name" value="" autocomplete="off" />`}
                        </td>
                        <td>${escapeHtml(entry.overall_year || "Insufficient Data")} (${escapeHtml(entry.confidence || "Low")})</td>
                        <td>${escapeHtml(String(entry.sections_completed || 0))}/${escapeHtml(String(entry.section_count || 0))}</td>
                        <td>
                          ${entry.session_payload
                            ? `<button type="button" data-history-open="${escapeAttribute(entry.session_id)}">Open report</button>`
                            : `<span class="subtle">Legacy entry</span>`}
                          ${(!entry.student_name || !entry.teacher_name)
                            ? `<button type="button" data-history-save="${escapeAttribute(entry.session_id)}">Save</button>`
                            : ""}
                        </td>
                      </tr>
                    `)
                    .join("")}
                </tbody>
              </table>
            </div>`
          : ""}
      </section>`
    : "";

  const content = `
    <section class="panel panel-setup">
      ${resumeBanner}
      <h1>Phase 2 Maths Snapshot</h1>
      <p class="subtle">Select the sections you want to run, choose a starting year level, and enter names for the PDF report. Each section takes around 3–5 minutes. Hand the device to the student when ready.</p>
      ${historyPanel}

      <form id="setupForm" class="grid-form grid-form-setup">
        <fieldset class="start-mode start-mode-compact">
          <legend>Starting Questions</legend>
          <p class="subtle start-note">Chooses the first year-level questions shown for each section. Pre-Year 4 uses the Y3 set.</p>

          <label class="radio-row radio-choice">
            <input type="radio" name="startMode" value="from_pre_y4" checked />
            <span>Start from Pre-Year 4 check (Y3 question set) and build upon</span>
          </label>

          <div class="radio-row radio-row-specified">
            <label class="radio-choice">
              <input type="radio" name="startMode" value="specified" />
              <span>Start from specified year</span>
            </label>
            <div id="specifiedYearWrap" class="specified-year-inline disabled" aria-label="Specified year options">
              <label class="year-check">
                <input type="radio" name="startYear" value="3" disabled />
                <span>Pre-Y4</span>
              </label>
              <label class="year-check">
                <input type="radio" name="startYear" value="4" checked disabled />
                <span>Y4</span>
              </label>
              <label class="year-check">
                <input type="radio" name="startYear" value="5" disabled />
                <span>Y5</span>
              </label>
              <label class="year-check">
                <input type="radio" name="startYear" value="6" disabled />
                <span>Y6</span>
              </label>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Sections To Run</legend>
          <div class="selection-tools">
            <button type="button" id="selectAllSectionsBtn">Select All</button>
            <button type="button" id="clearSectionsBtn">Clear All</button>
            <span id="selectedSectionsCount" class="selection-count">0 selected</span>
          </div>
          <div class="section-grid">
            ${sections
              .map((section) => `
                <label class="checkbox-row section-card">
                  <input type="checkbox" name="sectionId" value="${section.section_id}" />
                  <span class="section-card-check" aria-hidden="true"></span>
                  <span class="section-card-body">
                    <span class="section-card-top">
                      <small class="section-card-strand">${escapeHtml(section.strand)}</small>
                      <strong>${escapeHtml(sectionLabel(section))}</strong>
                    </span>
                    <span class="section-card-bottom">
                      <span class="section-card-topic">${escapeHtml(section.topic || "Run this section to collect evidence in this area.")}</span>
                    </span>
                  </span>
                </label>
              `)
              .join("")}
          </div>
        </fieldset>

        <fieldset>
          <legend>Report Names</legend>
          <p class="subtle start-note">Added to downloaded PDF reports. Both fields are optional.</p>
          <div class="session-names-grid">
            <label class="session-name-label">
              Student name
              <input type="text" name="studentName" value="${escapeAttribute(savedSession?.student?.name || "")}" placeholder="e.g. Alex" autocomplete="off" />
            </label>
            <label class="session-name-label">
              Teacher name
              <input type="text" name="teacherName" value="${escapeAttribute(savedSession?.teacher?.name || "")}" placeholder="e.g. Ms Smith" autocomplete="off" />
            </label>
          </div>
        </fieldset>
        <p id="setupFormError" class="form-error" hidden></p>
        <button type="submit" class="btn-primary">Start Diagnostic Session</button>
      </form>
    </section>
  `;
  renderPage(content, { homeEnabled: false, activeStep: "setup" });

  const form = document.getElementById("setupForm");
  form.addEventListener("submit", onStartSession);
  bindSetupStartMode(form);
  bindSectionSelectionControls(form);

  const resumeBtn = document.getElementById("resumeSessionBtn");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => {
      state.session = loadSessionFromStorage();
      if (state.session.current_probe_section_id) {
        const probeRun = findCurrentProbeRun();
        if (probeRun) {
          renderTeacherProbe(probeRun);
          return;
        }
      }
      if (state.session.current_attempt) {
        renderAssessment();
      } else {
        const run = state.session.section_runs[state.session.current_section_index];
        if (run && run.summary) {
          const hasNextSection = state.session.current_section_index < state.session.section_runs.length - 1;
          if (hasNextSection) {
            moveToNextSection();
          } else {
            startTeacherProbeFlowOrFinalize();
          }
        } else {
          beginCurrentSection();
        }
      }
    });
  }
  const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
  if (toggleHistoryBtn) {
    toggleHistoryBtn.addEventListener("click", () => {
      state.ui.show_history_panel = !state.ui.show_history_panel;
      renderSetup();
    });
  }
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      clearSessionHistoryFromStorage();
      state.ui.show_history_panel = false;
      renderSetup();
    });
  }
  for (const button of document.querySelectorAll("[data-history-save]")) {
    button.addEventListener("click", () => {
      saveHistoryNames(button.dataset.historySave);
    });
  }
  for (const button of document.querySelectorAll("[data-history-open]")) {
    button.addEventListener("click", () => {
      openHistorySession(button.dataset.historyOpen);
    });
  }
  const discardBtn = document.getElementById("discardSessionBtn");
  if (discardBtn) {
    discardBtn.addEventListener("click", () => {
      clearSessionFromStorage();
      renderSetup();
    });
  }
}

function bindSetupStartMode(form) {
  const radios = form.querySelectorAll('input[name="startMode"]');
  for (const radio of radios) {
    radio.addEventListener("change", () => syncSetupStartMode(form));
  }
  syncSetupStartMode(form);
}

function syncSetupStartMode(form) {
  const selected = form.querySelector('input[name="startMode"]:checked')?.value;
  const yearInputs = [...form.querySelectorAll('input[name="startYear"]')];
  const wrap = form.querySelector("#specifiedYearWrap");
  const useSpecified = selected === "specified";

  for (const input of yearInputs) {
    input.disabled = !useSpecified;
  }
  if (wrap) {
    wrap.classList.toggle("disabled", !useSpecified);
  }
  if (useSpecified && !yearInputs.some((input) => input.checked) && yearInputs.length) {
    const defaultYear = yearInputs.find((input) => input.value === "4") || yearInputs[0];
    defaultYear.checked = true;
  }
}

function bindSectionSelectionControls(form) {
  const selectAllBtn = form.querySelector("#selectAllSectionsBtn");
  const clearBtn = form.querySelector("#clearSectionsBtn");
  const sectionInputs = [...form.querySelectorAll('input[name="sectionId"]')];

  const refreshCount = () => {
    const selectedCount = sectionInputs.filter((input) => input.checked).length;
    const countNode = form.querySelector("#selectedSectionsCount");
    if (countNode) {
      countNode.textContent = `${selectedCount} selected`;
    }
  };

  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      for (const input of sectionInputs) {
        input.checked = true;
      }
      refreshCount();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      for (const input of sectionInputs) {
        input.checked = false;
      }
      refreshCount();
    });
  }

  for (const input of sectionInputs) {
    input.addEventListener("change", refreshCount);
  }

  refreshCount();
}

function onStartSession(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  const selectedSectionIds = form.getAll("sectionId");
  if (!selectedSectionIds.length) {
    const errorEl = document.getElementById("setupFormError");
    if (errorEl) {
      errorEl.textContent = "Please select at least one section to begin.";
      errorEl.hidden = false;
    }
    return;
  }

  const startMode = String(form.get("startMode") || "from_pre_y4");
  const requestedStartYear = startMode === "specified"
    ? Number(form.get("startYear") || PHASE_MIN_YEAR)
    : PHASE_MIN_YEAR - 1;
  const teacherName = String(form.get("teacherName") || "").trim();
  const studentName = String(form.get("studentName") || "").trim();

  clearSessionFromStorage();

  const sectionRuns = selectedSectionIds.map((sectionId) => ({
    section_id: sectionId,
    attempts: [],
    summary: null,
    target_year_variant: requestedStartYear,
    diagnostic_summary: null,
    teacher_probe: {
      status: "not_run",
      probe_items: [],
      teacher_summary: ""
    }
  }));

  state.session = {
    session_id: getSessionId(),
    teacher: { name: teacherName },
    student: { name: studentName },
    start_year: requestedStartYear,
    start_mode: startMode,
    selected_section_ids: selectedSectionIds,
    section_runs: sectionRuns,
    current_section_index: 0,
    current_attempt: null,
    current_probe_section_id: null,
    generated_at: null,
    strand_summary: [],
    overall_summary: null,
    last_saved_at: null
  };

  state.notice = "";
  setReviewSection(selectedSectionIds[0] || null);
  saveSessionToStorage();
  beginCurrentSection();
}

function beginCurrentSection(optionalYear = null) {
  const run = getCurrentRun();
  if (!run) {
    finalizeSession();
    return;
  }

  const section = state.sectionsById.get(run.section_id);
  const years = availableYears(section);
  const year = optionalYear ?? nearestAvailableYear(years, state.session.start_year);
  const variant = getVariantByYear(section, year);

  state.session.current_attempt = {
    section_id: section.section_id,
    section_title: section.title,
    strand: section.strand,
    variant_id: variant.variant_id,
    year_level: variant.year_level,
    attempt_number: run.attempts.length + 1,
    item_ids: variant.item_refs,
    responses: {},
    current_item_index: 0
  };

  saveSessionToStorage();
  renderAssessment();
}

function renderAssessment() {
  const run = getCurrentRun();
  const attempt = state.session.current_attempt;
  const section = state.sectionsById.get(run.section_id);
  const items = attempt.item_ids.map((itemId) => state.itemsById.get(itemId));
  const sectionIndex = state.session.current_section_index + 1;
  const currentIndex = attempt.current_item_index;
  const currentItem = items[currentIndex];
  const currentResponse = attempt.responses[currentItem.item_id];
  const completedCount = items.filter((item) => !isBlank(attempt.responses[item.item_id])).length;
  const isLastQuestion = currentIndex === items.length - 1;
  const nextLabel = isLastQuestion ? "Save & Finish" : "Save & Next";
  const attemptYearLabel = yearLabelForDisplay(attempt.year_level);
  const assessmentHeaderContext = buildAssessmentHeaderContext(attempt.attempt_number, attemptYearLabel);
  const transitionNotice = state.notice
    ? `<p class="assessment-transition">${escapeHtml(state.notice)}</p>`
    : "";

  const content = `
    <section class="panel">
      <header class="assessment-header">
        <h1>${escapeHtml(sectionLabel(section))}</h1>
        <p>Section ${sectionIndex} of ${state.session.section_runs.length}</p>
      </header>
      ${transitionNotice}

      ${
        section.time_mode === "timed_flash"
          ? `<p class="note">Timed facts section: each item target is ${section.default_time_limit_seconds ?? 4} seconds. Skips are allowed and tracked.</p>`
          : ""
      }

      <section class="tracker-panel" aria-label="Question tracker">
        <div class="tracker-layout">
          <div class="tracker-main">
            <div class="tracker-head">
              <strong>Question ${currentIndex + 1} of ${items.length}</strong>
              <span>${completedCount}/${items.length} answered</span>
            </div>
            <div class="tracker-row">
              <div class="question-tracker">
                ${items
                  .map((item, index) => {
                    const response = attempt.responses[item.item_id];
                    const statusClass = isBlank(response)
                      ? "tracker-unanswered"
                      : (evaluateItemResponse(item, response) ? "tracker-correct" : "tracker-incorrect");
                    const currentClass = index === currentIndex ? "tracker-current" : "";
                    return `
                      <button
                        type="button"
                        class="tracker-step ${statusClass} ${currentClass}"
                        data-question-index="${index}"
                        aria-label="Go to question ${index + 1}"
                        title="Question ${index + 1}"
                      >${index + 1}</button>
                    `;
                  })
                  .join("")}
              </div>
              <div class="tracker-legend tracker-legend-inline">
                <span><i class="tracker-legend-dot tracker-correct"></i>Correct</span>
                <span><i class="tracker-legend-dot tracker-incorrect"></i>Incorrect</span>
                <span><i class="tracker-legend-dot tracker-unanswered"></i>Not yet answered</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <form id="questionForm" class="item-list">
        <article class="item-card">
          <h3>Q${currentIndex + 1}</h3>
          <p class="item-prompt">${formatPromptHtml(currentItem)}</p>
          ${renderItemInput(currentItem, currentResponse)}
        </article>
        <div class="actions-row">
          <button type="submit" class="btn-primary">${nextLabel}</button>
          ${isLastQuestion ? "" : `<button type="button" id="skipQuestionBtn" class="btn-skip">Skip Question</button>`}
        </div>
      </form>
    </section>
  `;
  renderPage(content, {
    homeEnabled: true,
    headerContextHtml: assessmentHeaderContext,
    activeStep: "assessment",
    shellMode: "student"
  });

  document.getElementById("questionForm").addEventListener("submit", onQuestionFormSubmit);
  const skipBtn = document.getElementById("skipQuestionBtn");
  if (skipBtn) skipBtn.addEventListener("click", onSkipQuestion);

  const trackerSteps = document.querySelectorAll(".tracker-step");
  for (const step of trackerSteps) {
    step.addEventListener("click", onQuestionTrackerClick);
  }

  focusQuestionInput();
}

function renderItemInput(item, savedResponse) {
  const hint = getInputHint(item);
  const defaultInputMode = getDefaultInputMode(item);

  if (isExpandedFormItem(item)) {
    const boxCount = expandedFormBoxCount(item);
    const gridColumns = expandedFormGridColumns(boxCount);
    const parts = [];
    for (let index = 1; index <= boxCount; index += 1) {
      const fieldKey = `exp${index}`;
      parts.push(
        `<input class="answer-input answer-input-expanded" name="${item.item_id}__${fieldKey}" value="${escapeAttribute(savedResponse?.[fieldKey] ?? "")}" autocomplete="off" inputmode="numeric" aria-label="Expanded part ${index} of ${boxCount}" />`
      );
      if (index < boxCount) {
        parts.push(`<span class="expanded-sep">+</span>`);
      }
    }
    return `
      <div class="expanded-boxes" style="--expanded-columns: ${escapeAttribute(gridColumns)};">
        ${parts.join("")}
      </div>
      ${hint ? `<p class="input-hint">${escapeHtml(hint)}</p>` : ""}
    `;
  }

  if (isFractionInputItem(item)) {
    const fractionResponse = normalizeFractionEntryResponse(savedResponse);
    const inputLayout = getFractionInputLayout(item);
    const showWholeField = inputLayout === "mixed";
    return `
      <div class="fraction-entry ${showWholeField ? "fraction-entry-mixed" : "fraction-entry-simple"}" aria-label="Fraction input">
        ${showWholeField ? `
        <input
          class="answer-input fraction-whole"
          name="${item.item_id}__whole"
          value="${escapeAttribute(fractionResponse.whole)}"
          inputmode="numeric"
          placeholder="whole"
          autocomplete="off"
          aria-label="Whole number"
        />
        <span class="fraction-whole-sep" aria-hidden="true"></span>` : ""}
        <div class="fraction-stack">
        <input
          class="answer-input fraction-slot fraction-num"
          name="${item.item_id}__num"
          value="${escapeAttribute(fractionResponse.numerator)}"
          inputmode="numeric"
          placeholder="top"
          autocomplete="off"
          aria-label="Numerator"
        />
        <span class="fraction-line" aria-hidden="true"></span>
        <input
          class="answer-input fraction-slot fraction-den"
          name="${item.item_id}__den"
          value="${escapeAttribute(fractionResponse.denominator)}"
          inputmode="numeric"
          placeholder="bottom"
          autocomplete="off"
          aria-label="Denominator"
        />
        </div>
      </div>
      ${hint ? `<p class="input-hint">${escapeHtml(hint)}</p>` : ""}
    `;
  }

  if (item.answer_type === "multi_field") {
    const fields = Array.isArray(item.fields) ? item.fields : [];
    return `
      <div class="field-group">
        ${fields
          .map(
            (field) => `
              <label class="field-group-label">
                ${escapeHtml(field.label)}
                <input
                  class="answer-input"
                  name="${item.item_id}__${field.field_id}"
                  value="${escapeAttribute(savedResponse?.[field.field_id] ?? "")}"
                  inputmode="${escapeAttribute(getInputModeForAnswerType(field.answer_type))}"
                  autocomplete="off"
                />
              </label>
            `
          )
          .join("")}
      </div>
      ${hint ? `<p class="input-hint">${escapeHtml(hint)}</p>` : ""}
    `;
  }

  return `
    <input class="answer-input" name="${item.item_id}" value="${escapeAttribute(savedResponse ?? "")}" inputmode="${escapeAttribute(defaultInputMode)}" autocomplete="off" />
    ${hint ? `<p class="input-hint">${escapeHtml(hint)}</p>` : ""}
  `;
}

function getDefaultInputMode(item) {
  if (item?.answer_type === "multi_field") {
    return "text";
  }
  return getInputModeForAnswerType(item?.answer_type);
}

function getInputModeForAnswerType(answerType) {
  if (answerType === "integer") {
    return "numeric";
  }
  if (answerType === "decimal" || answerType === "fraction") {
    return "decimal";
  }
  return "text";
}

function getInputHint(item) {
  const prompt = String(item.prompt || "");
  const answer = String(item.answer ?? "");

  if (/^expand this number/i.test(prompt)) {
    const boxCount = expandedFormBoxCount(item);
    const compactAnswerExample = String(item.answer ?? "")
      .replace(/\s+/g, "")
      .replace(/,+/g, ",");
    const example = compactAnswerExample || "700+50+9";
    return `Input help: use ${boxCount} boxes, or enter all parts in one box (e.g. ${example}).`;
  }
  if (normalizeLiteral(answer) === "=") {
    return "Enter = if both fractions are equivalent.";
  }
  if (item.answer_type === "short_text" && /\br\d+\b/.test(normalizeLiteral(answer))) {
    return "Use remainder form (for example 26 r1) or a matching decimal.";
  }
  if (isFractionInputItem(item)) {
    return getFractionInputLayout(item) === "mixed"
      ? "Use the whole-number box, then numerator over denominator."
      : "Use numerator over denominator.";
  }
  if (/percentage/i.test(prompt)) {
    return "Percentage answers can be entered with or without the % symbol.";
  }
  return "";
}

function onQuestionFormSubmit(event) {
  event.preventDefault();
  saveCurrentQuestionResponse();

  const attempt = state.session.current_attempt;
  const isLastQuestion = attempt.current_item_index === attempt.item_ids.length - 1;

  if (isLastQuestion) {
    finishCurrentAttempt();
    return;
  }

  attempt.current_item_index += 1;
  saveSessionToStorage();
  renderAssessment();
}

function onQuestionTrackerClick(event) {
  saveCurrentQuestionResponse();
  const index = Number(event.currentTarget.dataset.questionIndex);
  if (!Number.isInteger(index)) {
    return;
  }
  state.session.current_attempt.current_item_index = index;
  saveSessionToStorage();
  renderAssessment();
}

function onSkipQuestion() {
  const attempt = state.session.current_attempt;
  if (!attempt) return;
  const currentItemId = attempt.item_ids[attempt.current_item_index];
  attempt.responses[currentItemId] = "";
  const isLastQuestion = attempt.current_item_index === attempt.item_ids.length - 1;
  if (isLastQuestion) {
    finishCurrentAttempt();
    return;
  }
  attempt.current_item_index += 1;
  saveSessionToStorage();
  renderAssessment();
}

function saveCurrentQuestionResponse() {
  const attempt = state.session.current_attempt;
  if (!attempt) {
    return;
  }

  const currentItemId = attempt.item_ids[attempt.current_item_index];
  const item = state.itemsById.get(currentItemId);
  const form = document.getElementById("questionForm");
  if (!item || !form) {
    return;
  }

  attempt.responses[item.item_id] = readItemResponseFromForm(form, item);
  saveSessionToStorage();
}

function readItemResponseFromForm(form, item) {
  const formData = new FormData(form);

  if (isExpandedFormItem(item)) {
    const boxCount = expandedFormBoxCount(item);
    const response = {};
    for (let index = 1; index <= boxCount; index += 1) {
      const fieldKey = `exp${index}`;
      response[fieldKey] = normalizeInput(formData.get(`${item.item_id}__${fieldKey}`));
    }
    return response;
  }

  if (isFractionInputItem(item)) {
    return {
      whole: normalizeInput(formData.get(`${item.item_id}__whole`)),
      numerator: normalizeInput(formData.get(`${item.item_id}__num`)),
      denominator: normalizeInput(formData.get(`${item.item_id}__den`))
    };
  }

  if (item.answer_type === "multi_field") {
    const fields = Array.isArray(item.fields) ? item.fields : [];
    const fieldResponse = {};
    for (const field of fields) {
      const key = `${item.item_id}__${field.field_id}`;
      fieldResponse[field.field_id] = normalizeInput(formData.get(key));
    }
    return fieldResponse;
  }

  return normalizeInput(formData.get(item.item_id));
}

function finishCurrentAttempt() {
  const run = getCurrentRun();
  const section = state.sectionsById.get(run.section_id);
  const attempt = state.session.current_attempt;
  const items = attempt.item_ids.map((itemId) => state.itemsById.get(itemId));
  const evaluated = evaluateAttempt(section, attempt, items, attempt.responses);

  run.attempts.push(evaluated);

  const nextYear = determineNextYear(section, run.attempts, evaluated);
  if (nextYear !== null) {
    const currentYearLabel = yearLabelForDisplay(evaluated.year_level);
    const nextYearLabel = yearLabelForDisplay(nextYear);
    state.notice = nextYear > evaluated.year_level
      ? `Secure at ${currentYearLabel}. Escalating to ${nextYearLabel}.`
      : `Not Yet at ${currentYearLabel}. Checking ${nextYearLabel}.`;
    beginCurrentSection(nextYear);
    return;
  }

  run.summary = summarizeSection(section, run.attempts, run.target_year_variant);
  run.diagnostic_summary = buildDiagnosticSummary(section, run.summary);
  run.teacher_probe = buildTeacherProbePlan(section, run.summary, run.diagnostic_summary);
  state.session.current_attempt = null;
  setReviewSection(run.section_id);
  saveSessionToStorage();

  const hasNextSection = state.session.current_section_index < state.session.section_runs.length - 1;
  if (hasNextSection) {
    state.notice = `${sectionLabel(section)} completed. Moving to the next section.`;
    moveToNextSection();
    return;
  }

  startTeacherProbeFlowOrFinalize();
}

function moveToNextSection() {
  state.session.current_section_index += 1;
  state.session.current_attempt = null;
  beginCurrentSection();
}

function renderSectionSummary(run) {
  setReviewSection(run.section_id);
  const summary = run.summary;
  const section = state.sectionsById.get(run.section_id);
  const decision = buildSectionDecision(summary);
  const hasNextSection = state.session.current_section_index < state.session.section_runs.length - 1;
  const isSingleSectionSession = state.session.section_runs.length === 1;
  const isSessionComplete = !!state.session.generated_at;
  const showCompletionExports = isSingleSectionSession && isSessionComplete;
  const scoreDisplay = `${summary.correct_answers} / ${summary.total_questions} correct`;
  const primaryAction = hasNextSection
    ? `<button id="continueSectionBtn" class="btn-primary">Continue To Next Section</button>`
    : (!isSessionComplete
      ? `<button id="continueSectionBtn" class="btn-primary">Finish Assessment</button>`
      : (!isSingleSectionSession
        ? `<button id="backToResultsBtn" class="btn-primary">Back To Final Summary</button>`
        : ""));
  const exportActions = showCompletionExports
    ? `<div class="actions-row">
        <button id="downloadSectionPdfBtn">Print / Save Section PDF</button>
        <button id="exportCsvBtn">Export CSV</button>
        <button id="newSessionBtn">New Assessment</button>
      </div>`
    : `<p class="section-summary-export-note"><button id="downloadSectionPdfBtn" class="btn-linkish" type="button">Optional: Print / Save Section PDF</button></p>`;

  const content = `
    <section class="panel">
      <h1>${escapeHtml(sectionLabel(section))} — Results</h1>

      <div class="result-hero">
        <div class="result-hero-cell result-hero-primary">
          <span class="result-hero-label">Best-Fit Year Level</span>
          <span class="result-hero-value">${escapeHtml(decision.bestFitYear)}</span>
        </div>
        <div class="result-hero-cell">
          <span class="result-hero-label">Score</span>
          <span class="result-hero-value">${escapeHtml(scoreDisplay)}</span>
        </div>
        <div class="result-hero-cell">
          <span class="result-hero-label">Summary</span>
          <span class="result-hero-value result-hero-copy">${escapeHtml(decision.headline)}</span>
        </div>
      </div>

      <div class="summary-banner">
        <strong>Why this year level:</strong> ${escapeHtml(decision.evidence)}
      </div>

      <h2>Assessment Path</h2>
      <p class="subtle">This shows the order of year levels the student moved through during this section.</p>
      <div class="attempt-path">
        ${summary.attempts.map((attempt) => {
          const isObservedAttempt = yearLabelForDisplay(attempt.year_level) === summary.observed_year_level
            && attempt.mastery_band === summary.mastery_band;
          const outcomeCopy = describeAttemptProgress(attempt.mastery_band);
          return `
            <article class="attempt-card ${isObservedAttempt ? "attempt-card-observed" : ""}">
              <div class="attempt-card-head">
                <strong>${escapeHtml(formatTeacherYearLabel(attempt.year_level))}</strong>
                ${isObservedAttempt ? `<span class="attempt-card-flag">Observed level</span>` : ""}
              </div>
              <p class="attempt-card-metrics">${attempt.correct}/${attempt.total} correct${attempt.skipped ? ` · ${attempt.skipped} skipped` : ""}</p>
              <div class="attempt-card-outcome">
                <strong>${escapeHtml(describeAttemptBand(attempt.mastery_band))}</strong>
                <span class="attempt-card-copy">${escapeHtml(outcomeCopy)}</span>
              </div>
            </article>
          `;
        }).join("")}
      </div>

      <div class="actions-row">
        ${primaryAction}
      </div>
      ${exportActions}
    </section>
  `;

  renderPage(content, { homeEnabled: true, activeStep: "section", headerContextHtml: buildSessionHeaderContext() });

  const continueBtn = document.getElementById("continueSectionBtn");
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if (hasNextSection) {
        moveToNextSection();
        return;
      }
      finalizeSession({ renderMode: isSingleSectionSession ? "section" : "results", run });
    });
  }
  const backToResultsBtn = document.getElementById("backToResultsBtn");
  if (backToResultsBtn) {
    backToResultsBtn.addEventListener("click", () => {
      renderResultsFromSession();
    });
  }
  document.getElementById("downloadSectionPdfBtn").addEventListener("click", () => {
    downloadSectionTeacherPdf(run);
  });
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", downloadCsvExport);
  }
  const newSessionBtn = document.getElementById("newSessionBtn");
  if (newSessionBtn) {
    newSessionBtn.addEventListener("click", () => {
      clearSessionFromStorage();
      state.session = null;
      state.notice = "";
      renderSetup();
    });
  }
}

function renderTeacherProbe(run) {
  if (!run?.summary) {
    startTeacherProbeFlowOrFinalize();
    return;
  }

  const section = state.sectionsById.get(run.section_id);
  const diagnosticSummary = run.diagnostic_summary || buildDiagnosticSummary(section, run.summary);
  const teacherProbe = run.teacher_probe || buildTeacherProbePlan(section, run.summary, diagnosticSummary);
  const probeItems = teacherProbe.probe_items || [];
  const languageChecks = teacherProbe.language_checks || [];

  run.diagnostic_summary = diagnosticSummary;
  run.teacher_probe = teacherProbe;
  state.session.current_probe_section_id = run.section_id;
  saveSessionToStorage();

  const content = `
    <section class="panel">
      <h1>${escapeHtml(sectionLabel(section))} — Short Teacher Probe</h1>

      <form id="teacherProbeForm" class="teacher-probe-form">
        <div class="teacher-probe-list">
          ${probeItems.map((item, index) => `
            <article class="teacher-probe-card">
              <h3>Probe ${index + 1}</h3>
              <p class="teacher-probe-prompt">${escapeHtml(item.prompt)}</p>
              <div class="teacher-probe-grid">
                <label class="field-group-label">
                  Response
                  <select name="probeResponse__${escapeAttribute(item.probe_id)}">
                    ${["not_attempted", "secure", "partial", "incorrect"]
                      .map((value) => `<option value="${value}" ${item.response_mode === value ? "selected" : ""}>${escapeHtml(formatProbeResponseMode(value))}</option>`)
                      .join("")}
                  </select>
                </label>
                <label class="field-group-label">
                  Evidence focus
                  <input type="text" name="probeCode__${escapeAttribute(item.probe_id)}" value="${escapeAttribute(item.evidence_code || "")}" autocomplete="off" />
                </label>
              </div>
              <label class="field-group-label">
                Teacher note
                <textarea name="probeNote__${escapeAttribute(item.probe_id)}" rows="3" placeholder="What did the student do or say?">${escapeHtml(item.teacher_note || "")}</textarea>
              </label>
            </article>
          `).join("")}
        </div>

        <section class="teacher-language-check">
          <h2>Language Comprehension</h2>
          <p class="subtle">Use this when the wording may be part of the issue.</p>
          <div class="teacher-language-grid">
            ${languageChecks.map((item) => `
              <label class="field-group-label teacher-language-item">
                <span>${escapeHtml(item.term)}</span>
                <select name="languageCheck__${escapeAttribute(item.term)}">
                  ${["not_checked", "understood", "unclear", "not_understood"]
                    .map((value) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${escapeHtml(formatLanguageStatus(value))}</option>`)
                    .join("")}
                </select>
              </label>
            `).join("")}
          </div>
        </section>

        <label class="field-group-label">
          Teacher summary
          <textarea name="teacherProbeSummary" rows="4" placeholder="Short summary of what this probe clarified.">${escapeHtml(teacherProbe.teacher_summary || "")}</textarea>
        </label>

        <div class="actions-row">
          <button type="submit" class="btn-primary">Save Probe & Continue</button>
          <button type="button" id="skipTeacherProbeBtn">Skip Probe</button>
        </div>
      </form>
    </section>
  `;

  renderPage(content, {
    activeStep: "probe",
    headerContextHtml: buildSessionHeaderContext()
  });

  document.getElementById("teacherProbeForm").addEventListener("submit", onTeacherProbeSubmit);
  document.getElementById("skipTeacherProbeBtn").addEventListener("click", onTeacherProbeSkip);
}

function onTeacherProbeSubmit(event) {
  event.preventDefault();
  const run = findCurrentProbeRun();
  if (!run?.teacher_probe) {
    startTeacherProbeFlowOrFinalize();
    return;
  }

  const formData = new FormData(event.currentTarget);
  run.teacher_probe.probe_items = run.teacher_probe.probe_items.map((item) => ({
    ...item,
    response_mode: String(formData.get(`probeResponse__${item.probe_id}`) || "not_attempted"),
    evidence_code: String(formData.get(`probeCode__${item.probe_id}`) || "").trim(),
    teacher_note: String(formData.get(`probeNote__${item.probe_id}`) || "").trim()
  }));
  run.teacher_probe.language_checks = (run.teacher_probe.language_checks || []).map((item) => ({
    ...item,
    status: String(formData.get(`languageCheck__${item.term}`) || "not_checked")
  }));
  run.teacher_probe.teacher_summary = String(formData.get("teacherProbeSummary") || "").trim();
  run.teacher_probe.status = "completed";
  if (run.diagnostic_summary) {
    run.diagnostic_summary.teacher_probe_status = "completed";
    run.diagnostic_summary.likely_misconception = refineMisconceptionFromProbe(run.diagnostic_summary.likely_misconception, run.teacher_probe);
  }

  state.session.current_probe_section_id = null;
  saveSessionToStorage();
  startTeacherProbeFlowOrFinalize();
}

function onTeacherProbeSkip() {
  const run = findCurrentProbeRun();
  if (run?.teacher_probe) {
    run.teacher_probe.status = "recommended";
  }
  state.session.current_probe_section_id = null;
  saveSessionToStorage();
  startTeacherProbeFlowOrFinalize();
}

function evaluateAttempt(section, attempt, items, responses) {
  let correct = 0;
  let skipped = 0;

  const item_results = items.map((item) => {
    const response = item.item_id in responses ? responses[item.item_id] : defaultResponseForItem(item);
    const is_skipped = isBlank(response);

    if (is_skipped) {
      skipped += 1;
      return {
        item_id: item.item_id,
        response,
        is_correct: false,
        is_skipped: true,
        response_mode: "skipped"
      };
    }

    const is_correct = evaluateItemResponse(item, response);
    if (is_correct) {
      correct += 1;
    }

    return {
      item_id: item.item_id,
      response,
      is_correct,
      is_skipped: false,
      response_mode: "answered"
    };
  });

  const total = items.length;
  const score_percent = total ? round((correct / total) * 100, 2) : 0;
  const mastery_band = getMasteryBand(score_percent, section.mastery_thresholds);

  return {
    variant_id: attempt.variant_id,
    year_level: attempt.year_level,
    score_percent,
    correct,
    total,
    skipped,
    mastery_band,
    item_results
  };
}

function defaultResponseForItem(item) {
  if (isExpandedFormItem(item)) {
    const boxCount = expandedFormBoxCount(item);
    const response = {};
    for (let index = 1; index <= boxCount; index += 1) {
      response[`exp${index}`] = "";
    }
    return response;
  }

  if (isFractionInputItem(item)) {
    return { whole: "", numerator: "", denominator: "" };
  }

  if (item.answer_type === "multi_field") {
    const fields = Array.isArray(item.fields) ? item.fields : [];
    const response = {};
    for (const field of fields) {
      response[field.field_id] = "";
    }
    return response;
  }
  return "";
}

function evaluateItemResponse(item, response) {
  if (isExpandedFormItem(item)) {
    return expandedFormResponseMatch(response, item.answer);
  }

  if (item.answer_type === "multi_field") {
    const expectedObject = item.answer;
    const fields = Array.isArray(item.fields) ? item.fields : [];

    for (const field of fields) {
      const expectedValue = expectedObject[field.field_id];
      const fieldValue = response[field.field_id];
      const pseudoItem = {
        ...item,
        answer_type: field.answer_type,
        answer: expectedValue,
        accepted_answers: [],
        validation: item.validation || {}
      };
      if (!evaluateItemResponse(pseudoItem, fieldValue)) {
        return false;
      }
    }
    return true;
  }

  const accepted = [{ value: item.answer, kind: inferDefaultKind(item) }].concat(item.accepted_answers || []);

  for (const option of accepted) {
    if (matchesOption(item, response, option.value, option.kind)) {
      return true;
    }
  }

  return false;
}

function inferDefaultKind(item) {
  if (item.answer_type === "integer" || item.answer_type === "decimal") {
    return "equivalent_numeric";
  }
  if (isFractionResponseItem(item)) {
    return "equivalent_fraction";
  }
  return "literal";
}

function matchesOption(item, response, expectedValue, kind = "literal") {
  if (kind === "equivalent_numeric") {
    return numericMatch(response, expectedValue, item.validation?.numeric_tolerance ?? 0.000001);
  }

  if (kind === "equivalent_fraction") {
    return fractionEquivalentMatch(item, response, expectedValue, item.validation?.numeric_tolerance ?? 0.000001);
  }

  if (item.answer_type === "integer" || item.answer_type === "decimal") {
    return numericMatch(response, expectedValue, item.validation?.numeric_tolerance ?? 0.000001);
  }

  if (isFractionResponseItem(item)) {
    return fractionEquivalentMatch(item, response, expectedValue, item.validation?.numeric_tolerance ?? 0.000001)
      || literalMatch(response, expectedValue);
  }

  if (item.validation?.numeric_tolerance !== undefined) {
    return numericMatch(response, expectedValue, item.validation.numeric_tolerance)
      || literalMatch(response, expectedValue);
  }

  if (relationSymbolMatch(response, expectedValue)) {
    return true;
  }

  if (expandedFormMatch(response, expectedValue)) {
    return true;
  }

  if (percentageMatch(response, expectedValue, item.validation?.numeric_tolerance ?? 0.000001)) {
    return true;
  }

  return literalMatch(response, expectedValue);
}

function numericMatch(a, b, tolerance) {
  const left = parseNumeric(a);
  const right = parseNumeric(b);
  if (left === null || right === null) {
    return false;
  }
  return Math.abs(left - right) <= tolerance;
}

function fractionMatch(a, b, tolerance) {
  const left = parseFractionLike(a);
  const right = parseFractionLike(b);
  if (left === null || right === null) {
    return false;
  }
  return Math.abs(left - right) <= tolerance;
}

function fractionEquivalentMatch(item, response, expectedValue, tolerance) {
  if (!fractionMatch(response, expectedValue, tolerance)) {
    return false;
  }

  const requirement = getFractionFormatRequirement(item);
  if (requirement === "either") {
    return true;
  }

  const responseFormat = detectFractionFormat(response);
  if (responseFormat === "unknown") {
    return false;
  }

  return responseFormat === requirement;
}

function literalMatch(a, b) {
  return normalizeLiteral(a) === normalizeLiteral(b);
}

function relationSymbolMatch(response, expectedValue) {
  const expected = normalizeLiteral(expectedValue);
  if (expected !== "=") {
    return false;
  }
  return normalizeLiteral(response) === "=";
}

function percentageMatch(response, expectedValue, tolerance) {
  if (typeof expectedValue !== "string" || !expectedValue.includes("%")) {
    return false;
  }
  const left = parseNumeric(response);
  const right = parseNumeric(expectedValue);
  if (left === null || right === null) {
    return false;
  }
  return Math.abs(left - right) <= tolerance;
}

function expandedFormMatch(response, expectedValue) {
  const expectedTerms = parseExpandedTerms(expectedValue);
  if (!expectedTerms) {
    return false;
  }

  const responseTerms = parseExpandedTerms(response);
  if (!responseTerms || expectedTerms.length !== responseTerms.length) {
    return false;
  }

  const sortedExpected = [...expectedTerms].sort((a, b) => a - b);
  const sortedResponse = [...responseTerms].sort((a, b) => a - b);
  return sortedExpected.every((value, index) => Math.abs(value - sortedResponse[index]) <= 0.000001);
}

function expandedFormResponseMatch(response, expectedValue) {
  return expandedFormMatch(response, expectedValue);
}

function parseExpandedTerms(value) {
  if (typeof value === "object" && value !== null) {
    return parseExpandedObjectTerms(value);
  }

  const raw = String(value ?? "").trim();
  if (!raw || raw.includes("=") || raw.includes("%")) {
    return null;
  }

  const parts = splitExpandedTerms(raw, false);
  if (!parts) {
    return null;
  }

  return numericTerms(parts);
}

function parseExpandedObjectTerms(responseObject) {
  const values = Object.values(responseObject).map((value) => String(value ?? "").trim()).filter(Boolean);
  if (!values.length) {
    return null;
  }

  if (values.length === 1) {
    const oneBox = splitExpandedTerms(values[0], false);
    if (!oneBox) {
      return null;
    }
    return numericTerms(oneBox);
  }

  const combined = [];
  for (const value of values) {
    const parts = splitExpandedTerms(value, true);
    if (!parts) {
      return null;
    }
    const terms = numericTerms(parts);
    if (!terms) {
      return null;
    }
    combined.push(...terms);
  }

  return combined;
}

function splitExpandedTerms(value, allowSingle) {
  const text = expandUnicodeFractions(String(value ?? "").trim());
  if (!text || text.includes("=") || text.includes("%")) {
    return null;
  }

  let parts;
  if (text.includes("+")) {
    parts = text.split("+");
  } else if (text.includes(",")) {
    parts = text.split(",");
  } else {
    parts = text.split(/\s+/);
  }

  const cleaned = parts.map((part) => part.trim()).filter(Boolean);
  if (!cleaned.length) {
    return null;
  }
  if (!allowSingle && cleaned.length < 2) {
    return null;
  }
  return cleaned;
}

function numericTerms(parts) {
  const terms = [];
  for (const part of parts) {
    const parsed = parseNumeric(part);
    if (parsed === null) {
      return null;
    }
    terms.push(parsed);
  }
  return terms;
}

function isExpandedFormItem(item) {
  return /^expand this number/i.test(String(item?.prompt ?? ""));
}

function expandedFormBoxCount(item) {
  const expectedTerms = parseExpandedTerms(item?.answer);
  if (expectedTerms?.length) {
    return expectedTerms.length;
  }

  const prompt = String(item?.prompt ?? "");
  const promptNumber = prompt.match(/expand this number:\s*([\d,]+)/i)?.[1] ?? "";
  const digitCount = promptNumber.replace(/\D/g, "").length;
  if (digitCount > 0) {
    return digitCount;
  }

  return 3;
}

function expandedFormGridColumns(boxCount) {
  const count = Math.max(2, Number(boxCount) || 2);
  const columns = [];
  for (let index = 0; index < count; index += 1) {
    columns.push("minmax(64px, 1fr)");
    if (index < count - 1) {
      columns.push("auto");
    }
  }
  return columns.join(" ");
}

function isFractionInputItem(item) {
  return isFractionResponseItem(item) && !hasRelationSymbolAnswer(item);
}

function isFractionResponseItem(item) {
  return item?.answer_type === "fraction"
    || !!item?.validation?.fraction_equivalence
    || getFractionFormatRequirement(item) !== "either";
}

function hasRelationSymbolAnswer(item) {
  const accepted = [{ value: item?.answer }].concat(item?.accepted_answers || []);
  return accepted.some((option) => normalizeLiteral(option?.value) === "=");
}

function getFractionInputLayout(item) {
  return getFractionFormatRequirement(item) === "mixed" ? "mixed" : "simple";
}

function getFractionFormatRequirement(item) {
  const prompt = String(item?.prompt || "").toLowerCase();
  if (prompt.includes("mixed number")) {
    return "mixed";
  }
  if (prompt.includes("improper fraction")) {
    return "improper";
  }
  return "either";
}

function detectFractionFormat(value) {
  if (typeof value === "object" && value !== null) {
    const whole = String(value.whole ?? "").trim();
    const numerator = String(value.numerator ?? "").trim();
    const denominator = String(value.denominator ?? "").trim();
    const populatedValues = [whole, numerator, denominator].filter(Boolean);
    if (populatedValues.length === 1) {
      return detectFractionFormat(populatedValues[0]);
    }
    if (whole && numerator && denominator) {
      return "mixed";
    }
    if (!whole && numerator && denominator) {
      return "improper";
    }
    if (whole && !numerator && !denominator) {
      return "mixed";
    }
    return "unknown";
  }

  const text = expandUnicodeFractions(String(value ?? ""))
    .trim()
    .replace(/,/g, "")
    .replace(/\s+/g, " ");

  if (!text) {
    return "unknown";
  }
  if (/^-?\d+\s+\d+\/\d+$/.test(text)) {
    return "mixed";
  }
  if (/^-?\d+\/\d+$/.test(text)) {
    return "improper";
  }
  if (/^-?\d+$/.test(text)) {
    return "mixed";
  }
  return "unknown";
}

function formatPromptForDisplay(item) {
  const prompt = String(item?.prompt ?? "");
  if (isFractionInputItem(item)) {
    return prompt;
  }
  return prompt.replace(/\s\/\s/g, " ÷ ");
}

function formatPromptHtml(item) {
  const prompt = formatPromptForDisplay(item);
  return renderInlineFractions(prompt);
}

function renderInlineFractions(text) {
  const source = String(text ?? "");
  const pattern = /\\frac\{([^{}]+)\}\{([^{}]+)\}|(^|[^\w])(-?\d+)\/(\d+)(?=$|[^\w])/g;
  let html = "";
  let lastIndex = 0;

  for (const match of source.matchAll(pattern)) {
    const matchText = match[0];
    const matchIndex = match.index ?? 0;
    const isLatexFraction = match[1] !== undefined;

    html += escapeHtml(source.slice(lastIndex, matchIndex));

    if (isLatexFraction) {
      html += buildInlineFractionHtml(match[1], match[2]);
    } else {
      const prefix = match[3] ?? "";
      html += escapeHtml(prefix);
      html += buildInlineFractionHtml(match[4], match[5]);
    }

    lastIndex = matchIndex + matchText.length;
  }

  html += escapeHtml(source.slice(lastIndex));
  return html;
}

function buildInlineFractionHtml(numerator, denominator) {
  const numeratorText = String(numerator ?? "").trim();
  const denominatorText = String(denominator ?? "").trim();
  const ariaLabel = `${numeratorText} over ${denominatorText}`;
  return `
    <span class="inline-fraction" aria-label="${escapeAttribute(ariaLabel)}">
      <span class="inline-fraction-num">${escapeHtml(numeratorText)}</span>
      <span class="inline-fraction-line" aria-hidden="true"></span>
      <span class="inline-fraction-den">${escapeHtml(denominatorText)}</span>
    </span>
  `;
}

function normalizeFractionEntryResponse(value) {
  if (typeof value === "object" && value !== null) {
    return {
      whole: String(value.whole ?? "").trim(),
      numerator: String(value.numerator ?? "").trim(),
      denominator: String(value.denominator ?? "").trim()
    };
  }

  const text = expandUnicodeFractions(String(value ?? ""))
    .trim()
    .replace(/,/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ");

  if (!text) {
    return { whole: "", numerator: "", denominator: "" };
  }

  const mixedMatch = text.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return {
      whole: mixedMatch[1],
      numerator: mixedMatch[2],
      denominator: mixedMatch[3]
    };
  }

  const fractionMatchResult = text.match(/^(-?\d+)\/(\d+)$/);
  if (fractionMatchResult) {
    return {
      whole: "",
      numerator: fractionMatchResult[1],
      denominator: fractionMatchResult[2]
    };
  }

  if (/^-?\d+$/.test(text)) {
    return { whole: text, numerator: "", denominator: "" };
  }

  return { whole: text, numerator: "", denominator: "" };
}

function focusQuestionInput() {
  const form = document.getElementById("questionForm");
  if (!form) {
    return;
  }

  const inputs = [...form.querySelectorAll("input:not([disabled])")];
  if (!inputs.length) {
    return;
  }

  const target = inputs.find((input) => !String(input.value || "").trim()) || inputs[0];
  requestAnimationFrame(() => {
    target.focus({ preventScroll: true });
    if (typeof target.setSelectionRange === "function") {
      const end = String(target.value || "").length;
      target.setSelectionRange(end, end);
    }
  });
}

function parseNumeric(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const sanitized = value
    .trim()
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/\s+/g, "");

  if (!sanitized) {
    return null;
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFractionLike(value) {
  if (typeof value === "object" && value !== null) {
    const wholeRaw = String(value.whole ?? "").trim();
    const numeratorRaw = String(value.numerator ?? "").trim();
    const denominatorRaw = String(value.denominator ?? "").trim();
    const populatedValues = [wholeRaw, numeratorRaw, denominatorRaw].filter(Boolean);

    if (!wholeRaw && !numeratorRaw && !denominatorRaw) {
      return null;
    }

    if (populatedValues.length === 1) {
      return parseFractionLike(populatedValues[0]);
    }

    if (wholeRaw && !numeratorRaw && !denominatorRaw) {
      return parseNumeric(wholeRaw);
    }

    if (!wholeRaw && numeratorRaw && !denominatorRaw) {
      return parseNumeric(numeratorRaw);
    }

    const whole = wholeRaw ? parseNumeric(wholeRaw) : 0;
    const numerator = parseNumeric(numeratorRaw);
    const denominator = parseNumeric(denominatorRaw);
    if ((wholeRaw && whole === null) || numerator === null || denominator === null || denominator === 0) {
      return null;
    }

    const sign = whole < 0 ? -1 : 1;
    return whole + sign * (numerator / denominator);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const expanded = expandUnicodeFractions(value)
    .trim()
    .replace(/,/g, "")
    .replace(/\s+/g, " ");

  if (!expanded) {
    return null;
  }

  const mixedMatch = expanded.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const numerator = Number(mixedMatch[2]);
    const denominator = Number(mixedMatch[3]);
    if (!denominator) {
      return null;
    }
    const sign = whole < 0 ? -1 : 1;
    return whole + sign * (numerator / denominator);
  }

  const fractionMatchResult = expanded.match(/^(-?\d+)\/(\d+)$/);
  if (fractionMatchResult) {
    const numerator = Number(fractionMatchResult[1]);
    const denominator = Number(fractionMatchResult[2]);
    if (!denominator) {
      return null;
    }
    return numerator / denominator;
  }

  const numeric = Number(expanded.replace(/\s+/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function expandUnicodeFractions(input) {
  const map = {
    "\u00BD": "1/2",
    "\u2153": "1/3",
    "\u2154": "2/3",
    "\u00BC": "1/4",
    "\u00BE": "3/4",
    "\u2155": "1/5",
    "\u2156": "2/5",
    "\u2157": "3/5",
    "\u2158": "4/5",
    "\u2159": "1/6",
    "\u215A": "5/6",
    "\u215B": "1/8",
    "\u215C": "3/8",
    "\u215D": "5/8",
    "\u215E": "7/8"
  };

  let text = String(input);
  for (const [symbol, fraction] of Object.entries(map)) {
    const withWhole = new RegExp(`(\\d)${symbol}`, "g");
    text = text.replace(withWhole, `$1 ${fraction}`);
    text = text.replaceAll(symbol, fraction);
  }
  return text;
}

function getMasteryBand(scorePercent, thresholds) {
  if (scorePercent >= thresholds.secure_pct) {
    return "Secure";
  }
  if (scorePercent >= thresholds.developing_pct) {
    return "Developing";
  }
  return "Not Yet";
}

function determineNextYear(section, attempts, evaluatedAttempt) {
  const years = availableYears(section);
  const attempted = new Set(attempts.map((attempt) => attempt.year_level));
  const currentIndex = years.indexOf(evaluatedAttempt.year_level);

  if (currentIndex === -1) {
    return null;
  }

  if (evaluatedAttempt.mastery_band === "Secure") {
    const nextYear = years[currentIndex + 1];
    if (nextYear && !attempted.has(nextYear)) {
      return nextYear;
    }
  }

  if (evaluatedAttempt.mastery_band === "Not Yet") {
    const previousYear = years[currentIndex - 1];
    if (previousYear && !attempted.has(previousYear)) {
      return previousYear;
    }
  }

  return null;
}

function summarizeSection(section, attempts, targetYearVariant = null) {
  const sorted = [...attempts].sort((a, b) => a.year_level - b.year_level);
  const secure = sorted.filter((attempt) => attempt.mastery_band === "Secure");
  const developing = sorted.filter((attempt) => attempt.mastery_band === "Developing");

  let chosen = null;
  let observed_year_level = "Not Attempted";

  if (secure.length) {
    chosen = secure[secure.length - 1];
    observed_year_level = yearLabelForDisplay(chosen.year_level);
  } else if (developing.length) {
    chosen = developing[developing.length - 1];
    observed_year_level = yearLabelForDisplay(chosen.year_level);
  } else if (sorted.length) {
    observed_year_level = PRE_PHASE_LABEL;
  }

  const confidence = computeSectionConfidence(sorted, observed_year_level);
  const scoringAttempt = chosen ?? sorted[sorted.length - 1] ?? null;

  return {
    section_id: section.section_id,
    section_title: section.title,
    strand: section.strand,
    target_year_variant: targetYearVariant ?? sorted[0]?.year_level ?? null,
    attempts: sorted,
    observed_year_level,
    score_percent: chosen?.score_percent ?? 0,
    mastery_band: chosen?.mastery_band ?? "Not Yet",
    confidence,
    correct_answers: scoringAttempt?.correct ?? 0,
    total_questions: scoringAttempt?.total ?? 0
  };
}

function buildDiagnosticSummary(section, summary) {
  const riskFlags = buildSectionRiskFlags(section, summary);
  const likelyMisconception = inferLikelyMisconception(section, summary, riskFlags);
  const lastSecureSkill = inferLastSecureSkill(section, summary);
  const recommendedRepresentation = inferRecommendedRepresentation(section, summary, riskFlags);
  const teacher_probe_needed = summary.confidence !== "High" || riskFlags.length > 0;

  return {
    last_secure_skill: lastSecureSkill,
    likely_misconception: likelyMisconception,
    recommended_representation: recommendedRepresentation,
    teacher_probe_needed,
    teacher_probe_status: teacher_probe_needed ? "recommended" : "not_needed",
    confidence_risk_flags: riskFlags,
    rationale: buildDiagnosticRationale(summary, riskFlags)
  };
}

function buildSectionRiskFlags(section, summary) {
  const attempts = summary?.attempts || [];
  const total = attempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const skipped = attempts.reduce((sum, attempt) => sum + attempt.skipped, 0);
  const skipRate = total ? skipped / total : 0;
  const flags = [];

  if (summary?.confidence === "Low") {
    flags.push("low_confidence");
  }
  if (skipRate >= 0.3) {
    flags.push("high_skip_rate");
  }
  if (attempts.length <= 1) {
    flags.push("sparse_evidence");
  }
  if (summary?.confidence !== "High") {
    flags.push("boundary_not_confirmed");
  }

  const prompts = attempts
    .flatMap((attempt) => attempt.item_results || [])
    .filter((result) => !result.is_correct)
    .map((result) => String(state.itemsById.get(result.item_id)?.prompt || "").toLowerCase());

  if (section?.section_id === "sec_01" && prompts.some((prompt) => prompt.includes("less than"))) {
    flags.push("place_value_direction_risk");
  }
  if (prompts.some((prompt) => prompt.includes("how many tens are in"))) {
    flags.push("grouping_language_risk");
  }

  return [...new Set(flags)];
}

function inferLikelyMisconception(section, summary, riskFlags) {
  const attempts = summary?.attempts || [];
  const wrongPrompts = attempts
    .flatMap((attempt) => attempt.item_results || [])
    .filter((result) => !result.is_correct)
    .map((result) => String(state.itemsById.get(result.item_id)?.prompt || "").toLowerCase());

  if (section?.section_id === "sec_01") {
    if (wrongPrompts.some((prompt) => prompt.includes("how many tens are in"))) {
      return "May recognise digit positions but not total groups of ten within a number.";
    }
    if (wrongPrompts.some((prompt) => prompt.includes("expand this number"))) {
      return "May not yet partition numbers flexibly into hundreds, tens, and ones.";
    }
    if (riskFlags.includes("place_value_direction_risk")) {
      return "May be confusing 'less than' with counting on, or may not yet see the number as structured hundreds, tens, and ones.";
    }
  }

  if (section?.strand === "Number Structure") {
    return "Place-value structure is not yet secure enough at this level.";
  }
  if (section?.strand === "Number Operations") {
    return "Method choice and place-value alignment need checking at this level.";
  }
  if (section?.strand === "Rational Numbers") {
    return "The relationship between fractions, decimals, or percentages is not yet secure enough at this level.";
  }

  return "The current evidence shows a gap, but the exact cause still needs a quick teacher check.";
}

function inferLastSecureSkill(section, summary) {
  const { observedAttempt, lowerSecureAttempt, lowestAttempt } = getSummaryAttemptContext(summary);

  if (lowerSecureAttempt) {
    return `${formatTeacherYearLabel(lowerSecureAttempt.year_level)} tasks in ${section?.topic || summary.section_title} were secure.`;
  }

  if (summary?.mastery_band === "Secure" && observedAttempt) {
    return `${formatTeacherYearLabel(observedAttempt.year_level)} tasks in ${section?.topic || summary.section_title} were secure.`;
  }

  if (lowestAttempt) {
    return `Start just below ${formatTeacherYearLabel(lowestAttempt.year_level)} tasks in ${section?.topic || summary.section_title}.`;
  }

  return `Collect a few easier checks in ${section?.topic || summary.section_title} to find the secure floor.`;
}

function inferRecommendedRepresentation(section, summary, riskFlags) {
  if (section?.section_id === "sec_01") {
    return "Use a place-value chart with MAB or bundled sticks.";
  }
  if (riskFlags.includes("grouping_language_risk")) {
    return "Use materials first, then restate the question aloud using simpler maths language.";
  }
  if (section?.strand === "Number Structure") {
    return "Use place-value charts, materials, and short oral prompts.";
  }
  if (section?.strand === "Number Operations") {
    return "Use worked examples, number lines, and place-value-aligned written methods.";
  }
  if (section?.strand === "Rational Numbers") {
    return "Use visual fraction models, folding, and matching tasks before symbolic recording.";
  }
  return "Use concrete materials first, then shift to symbols.";
}

function buildDiagnosticRationale(summary, riskFlags) {
  const parts = [];

  if (summary?.confidence === "Low") {
    parts.push("The current year-level placement is low-confidence");
  } else if (summary?.confidence === "Medium") {
    parts.push("The current year-level placement is usable but not fully confirmed");
  }

  if (riskFlags.includes("high_skip_rate")) {
    parts.push("skips were high enough to blur whether the barrier was knowledge, language load, or shutdown");
  }
  if (riskFlags.includes("boundary_not_confirmed")) {
    parts.push("the upper or lower boundary was not confirmed strongly enough");
  }
  if (riskFlags.includes("place_value_direction_risk")) {
    parts.push("the error pattern suggests a possible before/after or place-value direction issue");
  }

  if (!parts.length) {
    return "The section evidence is strong enough that no short teacher probe is needed.";
  }

  return `${parts.join("; ")}.`;
}

function buildTeacherProbePlan(section, summary, diagnosticSummary) {
  if (!diagnosticSummary?.teacher_probe_needed) {
    return {
      status: "not_run",
      probe_items: [],
      language_checks: buildLanguageCheckItems(section),
      teacher_summary: ""
    };
  }

  const prompts = getTeacherProbePrompts(section, summary);
  return {
    status: "recommended",
    probe_items: prompts.map((prompt, index) => ({
      probe_id: `${section.section_id}_probe_${index + 1}`,
      prompt: prompt.prompt,
      response_mode: "not_attempted",
      evidence_code: prompt.evidence_code,
      teacher_note: ""
    })),
    language_checks: buildLanguageCheckItems(section),
    teacher_summary: ""
  };
}

function getTeacherProbePrompts(section, summary) {
  if (section?.section_id === "sec_01") {
    return [
      { prompt: "Show me 409 with materials or a place-value chart.", evidence_code: "representation_check" },
      { prompt: "What is 1 less than 409? How do you know?", evidence_code: "before_after_direction" },
      { prompt: "What is 10 less than 409? Show me.", evidence_code: "regrouping_across_zero" },
      { prompt: "Expand 759.", evidence_code: "partitioning" }
    ];
  }

  if (section?.strand === "Number Operations") {
    return [
      { prompt: `Solve one similar ${summary.section_title.toLowerCase()} item aloud.`, evidence_code: "strategy_choice" },
      { prompt: "Show the steps with a number line, place-value chart, or written method.", evidence_code: "representation_check" },
      { prompt: "Explain why you chose that method.", evidence_code: "mathematical_language" }
    ];
  }

  if (section?.strand === "Rational Numbers") {
    return [
      { prompt: "Show the idea with a diagram or materials before using symbols.", evidence_code: "representation_check" },
      { prompt: "Explain what each part of the fraction or decimal means.", evidence_code: "concept_language" },
      { prompt: "Solve one similar item and explain your thinking aloud.", evidence_code: "strategy_choice" }
    ];
  }

  return [
    { prompt: "Solve one similar item aloud and explain your thinking.", evidence_code: "thinking_explanation" },
    { prompt: "Show the same idea with materials or a simple diagram.", evidence_code: "representation_check" },
    { prompt: "Tell me which maths words in the question helped you.", evidence_code: "language_check" }
  ];
}

function buildLanguageCheckItems(section) {
  const baseTerms = ["digit", "number"];
  const sectionTerms = section?.section_id === "sec_01"
    ? ["less than", "more than", "before", "after", "tens", "hundreds", "expand", "how many tens are in"]
    : section?.strand === "Number Structure"
      ? ["less than", "more than", "before", "after", "tens", "hundreds", "expand"]
      : section?.strand === "Rational Numbers"
        ? ["fraction", "numerator", "denominator", "equivalent", "percentage"]
        : ["add", "subtract", "multiply", "divide", "more than", "less than"];

  return [...new Set(baseTerms.concat(sectionTerms))].map((term) => ({
    term,
    status: "not_checked"
  }));
}

function formatProbeResponseMode(value) {
  const labels = {
    not_attempted: "Not yet checked",
    secure: "Secure",
    partial: "Partial",
    incorrect: "Incorrect"
  };
  return labels[value] || value;
}

function formatLanguageStatus(value) {
  const labels = {
    not_checked: "Not checked",
    understood: "Understood",
    unclear: "Unclear",
    not_understood: "Not understood"
  };
  return labels[value] || value;
}

function formatTeacherProbeStatus(value) {
  const labels = {
    not_needed: "Not needed",
    not_run: "Not run",
    recommended: "Recommended",
    completed: "Completed"
  };
  return labels[value] || value;
}

function refineMisconceptionFromProbe(fallback, teacherProbe) {
  const items = teacherProbe?.probe_items || [];
  const secureCount = items.filter((item) => item.response_mode === "secure").length;
  const incorrectCount = items.filter((item) => item.response_mode === "incorrect").length;
  const representationDifficulty = items.some(
    (item) => item.evidence_code === "representation_check" && item.response_mode === "incorrect"
  );
  const languageDifficulty = items.some(
    (item) => /language/.test(String(item.evidence_code || "")) && item.response_mode !== "secure"
  );

  if (representationDifficulty) {
    return "The student still struggled when the idea was shown with materials or diagrams, so the core concept likely needs reteaching.";
  }
  if (languageDifficulty) {
    return "The student may know more than the written assessment showed, but the maths language still needs explicit teaching.";
  }
  if (secureCount >= 2 && incorrectCount === 0) {
    return "The original written items may have overstated the gap; the student showed stronger understanding in the live probe.";
  }
  return fallback;
}

function startTeacherProbeFlowOrFinalize() {
  const nextRun = findNextProbeRun();
  if (!nextRun) {
    state.session.current_probe_section_id = null;
    state.notice = "";
    finalizeSession();
    return;
  }

  state.session.current_probe_section_id = nextRun.section_id;
  saveSessionToStorage();
  renderTeacherProbe(nextRun);
}

function computeSectionConfidence(attempts, observedYearLabel) {
  if (!attempts.length || attempts.length === 1) {
    return "Low";
  }

  const total = attempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const skipped = attempts.reduce((sum, attempt) => sum + attempt.skipped, 0);
  const skipRate = total ? skipped / total : 1;

  if (skipRate > 0.4) {
    return "Low";
  }

  if (observedYearLabel === PRE_PHASE_LABEL) {
    const hasY4Boundary = attempts.some(
      (attempt) => attempt.year_level === PHASE_MIN_YEAR && attempt.mastery_band !== "Secure"
    );
    return hasY4Boundary ? "Medium" : "Low";
  }

  const observedYear = parseYearLabel(observedYearLabel);
  if (!Number.isFinite(observedYear)) {
    return "Low";
  }

  const hasUpperBoundary = attempts.some(
    (attempt) => attempt.year_level === observedYear + 1 && attempt.mastery_band !== "Secure"
  );

  if (hasUpperBoundary) {
    return "High";
  }

  return "Medium";
}

function completeSessionData() {
  const sectionSummaries = state.session.section_runs
    .map((run) => run.summary)
    .filter(Boolean);

  const strandSummary = buildStrandSummary(sectionSummaries);
  const overallSummary = buildOverallSummary(strandSummary);

  state.session.strand_summary = strandSummary;
  state.session.overall_summary = overallSummary;
  state.session.generated_at = new Date().toISOString();

  saveSessionToStorage();
  saveCompletedSessionToHistory();
  return { sectionSummaries, strandSummary, overallSummary };
}

function finalizeSession(options = {}) {
  const { renderMode = "results", run = null } = options;
  const { sectionSummaries, strandSummary, overallSummary } = completeSessionData();

  if (renderMode === "section" && run?.summary) {
    renderSectionSummary(run);
    return;
  }

  renderResults(sectionSummaries, strandSummary, overallSummary);
}

function renderResults(sectionSummaries, strandSummary, overallSummary) {
  const sectionReportRows = buildSectionReportRows();
  const completedSections = sectionReportRows.filter((row) => !!row.summary).length;
  const sessionAnalytics = buildAnalyticsSummaryFromRuns(state.session.section_runs);
  const prioritySteps = buildFinalNextSteps(sectionSummaries);
  const totalCorrect = `${sessionAnalytics.correct_answers} / ${sessionAnalytics.questions_answered} answered correctly`;
  const completedProbeRows = sectionReportRows.filter((row) => row.run?.teacher_probe?.status === "completed");

  const content = `
    <section class="panel">
      <h1>Teacher Report</h1>
      <p class="note">Formative snapshot evidence only. Use alongside teacher judgement.</p>

      <div class="result-hero result-hero-final">
        <div class="result-hero-cell result-hero-primary">
          <span class="result-hero-label">Overall NZC Best-Fit</span>
          <span class="result-hero-value result-hero-xl">${escapeHtml(formatTeacherYearLabel(overallSummary.observed_operating_year))}</span>
        </div>
        <div class="result-hero-cell">
          <span class="result-hero-label">Sections Completed</span>
          <span class="result-hero-value">${completedSections}/${sectionReportRows.length}</span>
        </div>
        <div class="result-hero-cell">
          <span class="result-hero-label">Questions</span>
          <span class="result-hero-value">${escapeHtml(totalCorrect)}</span>
        </div>
      </div>

      <h2>Sections</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>NZC Best-Fit</th>
              <th>Confidence</th>
              <th>Likely Issue</th>
              <th>Start Here</th>
              <th>Probe</th>
            </tr>
          </thead>
          <tbody>
            ${sectionReportRows
              .map((row) => {
                if (!row.summary) {
                  return `
                    <tr>
                      <td>${escapeHtml(sectionLabel(row.section))}</td>
                      <td>—</td>
                      <td>—</td>
                      <td>No evidence collected yet.</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  `;
                }
                const diagnosticSummary = row.run?.diagnostic_summary || buildDiagnosticSummary(row.section, row.summary);
                return `
                    <tr>
                      <td>${escapeHtml(sectionLabel(row.section))}</td>
                      <td>${escapeHtml(formatTeacherYearLabel(row.summary.observed_year_level))}</td>
                      <td>${escapeHtml(row.summary.confidence)}</td>
                      <td>${escapeHtml(diagnosticSummary.likely_misconception)}</td>
                      <td>${escapeHtml(diagnosticSummary.last_secure_skill)}</td>
                      <td>${escapeHtml(formatTeacherProbeStatus(row.run?.teacher_probe?.status || diagnosticSummary.teacher_probe_status))}</td>
                    </tr>
                  `;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      ${completedProbeRows.length
        ? `<h2>Probe Notes</h2>
            <div class="teacher-probe-list">
              ${completedProbeRows.map((row) => `
                <article class="teacher-probe-card">
                  <h3>${escapeHtml(sectionLabel(row.section))}</h3>
                  <p class="teacher-probe-prompt">${escapeHtml(row.run.teacher_probe.teacher_summary || "Probe completed. See saved item-level notes in the exported session file.")}</p>
                  ${row.run.teacher_probe.language_checks?.some((item) => item.status !== "not_checked")
                    ? `<p><strong>Language:</strong> ${escapeHtml(
                      row.run.teacher_probe.language_checks
                        .filter((item) => item.status !== "not_checked")
                        .map((item) => `${item.term} (${formatLanguageStatus(item.status)})`)
                        .join(", ")
                    )}</p>`
                    : ""}
                </article>
              `).join("")}
            </div>`
        : ""}

      <h2>Strand Summary</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Strand</th>
              <th>Observed Year</th>
              <th>Confidence</th>
              <th>Supporting Sections</th>
            </tr>
          </thead>
          <tbody>
            ${strandSummary
              .map((strand) => `
                <tr>
                  <td>${escapeHtml(strand.strand_name)}</td>
                  <td>${escapeHtml(formatTeacherYearLabel(strand.observed_year_level))}</td>
                  <td>${escapeHtml(strand.confidence)}</td>
                  <td>${escapeHtml(strand.supporting_sections.join(", "))}</td>
                </tr>
              `)
              .join("")}
          </tbody>
        </table>
      </div>

      <h2>Priority Next Steps</h2>
      <ul class="next-steps-list">
        ${prioritySteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ul>

      <h2>Report Names</h2>
      <p class="subtle">Used for exports and the saved reports list on this device.</p>
      <div class="session-names-grid">
        <label class="session-name-label">
          Student name
          <input id="resultsStudentNameInput" type="text" value="${escapeAttribute(state.session.student.name || "")}" placeholder="e.g. Alex" autocomplete="off" />
        </label>
        <label class="session-name-label">
          Teacher name
          <input id="resultsTeacherNameInput" type="text" value="${escapeAttribute(state.session.teacher.name || "")}" placeholder="e.g. Ms Smith" autocomplete="off" />
        </label>
      </div>
      <div class="actions-row actions-row-compact">
        <button id="saveReportNamesBtn" type="button">Update Report Names</button>
      </div>

      <div class="actions-row">
        <button id="downloadTeacherPdfBtn" class="btn-primary">Print / Save PDF</button>
        <button id="exportCsvBtn">Export CSV</button>
        <button id="newSessionBtn">New Session</button>
      </div>
    </section>
  `;
  renderPage(content, { homeEnabled: true, activeStep: "results", headerContextHtml: buildSessionHeaderContext() });

  document.getElementById("saveReportNamesBtn").addEventListener("click", saveReportNamesFromResults);
  document.getElementById("downloadTeacherPdfBtn").addEventListener("click", downloadFinalTeacherPdf);
  document.getElementById("exportCsvBtn").addEventListener("click", downloadCsvExport);
  document.getElementById("newSessionBtn").addEventListener("click", () => {
    clearSessionFromStorage();
    state.session = null;
    state.notice = "";
    renderSetup();
  });
}

function buildStrandSummary(sectionSummaries) {
  const byStrand = new Map();

  for (const summary of sectionSummaries) {
    if (!byStrand.has(summary.strand)) {
      byStrand.set(summary.strand, []);
    }
    byStrand.get(summary.strand).push(summary);
  }

  return [...byStrand.entries()].map(([strandName, summaries]) => {
    const numericYears = summaries
      .map((summary) => parseYearLabel(summary.observed_year_level))
      .filter((year) => Number.isFinite(year));

    let observedYear = "Insufficient Data";
    if (numericYears.length) {
      const averageYear = average(numericYears);
      observedYear = averageYear < PHASE_MIN_YEAR
        ? PRE_PHASE_LABEL
        : `Y${Math.round(averageYear)}`;
    }

    const confidence = reduceConfidence(summaries.map((summary) => summary.confidence));

    return {
      strand_name: strandName,
      observed_year_level: observedYear,
      confidence,
      supporting_sections: summaries.map((summary) => sectionLabel(state.sectionsById.get(summary.section_id)))
    };
  });
}

function buildOverallSummary(strandSummary) {
  let weightedScore = 0;
  let totalWeight = 0;

  for (const strand of strandSummary) {
    const year = parseYearLabel(strand.observed_year_level);
    if (!Number.isFinite(year)) {
      continue;
    }
    const weight = STRAND_WEIGHTS[strand.strand_name] ?? 0;
    weightedScore += year * weight;
    totalWeight += weight;
  }

  const observed_operating_year = totalWeight
    ? ((weightedScore / totalWeight) < PHASE_MIN_YEAR
      ? PRE_PHASE_LABEL
      : `Y${Math.round(weightedScore / totalWeight)}`)
    : "Insufficient Data";

  return {
    observed_operating_year,
    confidence: reduceConfidence(strandSummary.map((strand) => strand.confidence)),
    method: "Overall level calculated from section results"
  };
}

function downloadSectionTeacherPdf(run) {
  const section = state.sectionsById.get(run.section_id);
  const summary = run.summary;
  const decision = buildSectionDecision(summary);
  const evidence = buildSectionAllocationEvidence(summary);
  const phase = state.bank?.assessment?.learning_phase || "Phase 2";
  const nextSteps = getNextStepForSection(section, summary);
  const timestamp = formatReportTimestamp(new Date().toISOString());

  const attemptsRows = summary.attempts.map((attempt) => `
    <tr>
      <td>${escapeHtml(formatTeacherYearLabel(attempt.year_level))}</td>
      <td>${attempt.score_percent}%</td>
      <td>${attempt.correct}/${attempt.total}</td>
      <td>${attempt.skipped}</td>
      <td>${escapeHtml(describeAttemptBand(attempt.mastery_band))}</td>
    </tr>
  `).join("");

  const html = buildTeacherReportHtml({
    title: `${sectionLabel(section)} Teacher Report`,
    subtitle: `${phase} | Section Report`,
    metaRows: [
      ["Generated", timestamp],
      ["Teacher", state.session.teacher.name],
      ["Student", state.session.student.name],
      ["Section", sectionLabel(section)],
      ["Phase", phase],
      ["Best-Fit Year Level (Section)", decision.bestFitYear],
      ["Correct", `${summary.correct_answers}/${summary.total_questions}`]
    ],
    bodyHtml: `
      <h3>Year-Level Decision</h3>
      <p><strong>${escapeHtml(decision.headline)}</strong> ${escapeHtml(decision.evidence)}</p>
      <h3>Evidence Of Year / Phase Allocation</h3>
      <ul>${evidence.allocationLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      <h3>${escapeHtml(evidence.barrierHeading)}</h3>
      <p>${escapeHtml(evidence.barrierIntro)}</p>
      ${evidence.barrierItems.length
        ? `<table>
            <thead>
              <tr><th>Year</th><th>Prompt</th><th>Student Response</th><th>Expected</th><th>Issue</th></tr>
            </thead>
            <tbody>
              ${evidence.barrierItems.map((item) => `
                <tr>
                  <td>${escapeHtml(item.yearLabel)}</td>
                  <td>${escapeHtml(item.prompt)}</td>
                  <td>${escapeHtml(item.response)}</td>
                  <td>${escapeHtml(item.expected)}</td>
                  <td>${escapeHtml(item.issue)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`
        : `<p>No incorrect or skipped item detail is available for a boundary attempt.</p>`}
      <h3>Next Steps</h3>
      <ul>${nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>
      <h3>Attempt History</h3>
      <table>
        <thead>
          <tr><th>Year</th><th>Score</th><th>Correct</th><th>Skipped</th><th>What Happened</th></tr>
        </thead>
        <tbody>${attemptsRows}</tbody>
      </table>
      ${run.teacher_notes ? `<h3>Teacher Notes</h3><p>${escapeHtml(run.teacher_notes)}</p>` : ""}
    `
  });

  openPdfPrintWindow(html, `${safeFileBase()}_${section.section_id}_teacher_report`);
}

function downloadFinalTeacherPdf() {
  const phase = state.bank?.assessment?.learning_phase || "Phase 2";
  const sectionReportRows = buildSectionReportRows();
  const completedSections = sectionReportRows.filter((row) => !!row.summary).length;
  const summaryRows = sectionReportRows
    .map((row) => {
      if (!row.summary) {
        return `
          <tr>
            <td>${escapeHtml(sectionLabel(row.section))}</td>
            <td>—</td>
            <td>—</td>
            <td>No evidence collected yet.</td>
            <td>—</td>
            <td>—</td>
          </tr>
        `;
      }
      const diagnosticSummary = row.run?.diagnostic_summary || buildDiagnosticSummary(row.section, row.summary);
      return `
        <tr>
          <td>${escapeHtml(sectionLabel(row.section))}</td>
          <td>${escapeHtml(formatTeacherYearLabel(row.summary.observed_year_level))}</td>
          <td>${escapeHtml(row.summary.confidence)}</td>
          <td>${escapeHtml(diagnosticSummary.likely_misconception)}</td>
          <td>${escapeHtml(diagnosticSummary.last_secure_skill)}</td>
          <td>${escapeHtml(formatTeacherProbeStatus(row.run?.teacher_probe?.status || diagnosticSummary.teacher_probe_status))}</td>
        </tr>
      `;
    })
    .join("");
  const probeBlocks = sectionReportRows
    .filter((row) => row.run?.teacher_probe?.status === "completed")
    .map((row) => `
      <h3>${escapeHtml(sectionLabel(row.section))} Probe</h3>
      <p>${escapeHtml(row.run.teacher_probe.teacher_summary || "Probe completed with item-level notes only.")}</p>
      ${row.run.teacher_probe.language_checks?.some((item) => item.status !== "not_checked")
        ? `<p><strong>Language:</strong> ${escapeHtml(
          row.run.teacher_probe.language_checks
            .filter((item) => item.status !== "not_checked")
            .map((item) => `${item.term} (${formatLanguageStatus(item.status)})`)
            .join(", ")
        )}</p>`
        : ""}
      <table>
        <thead>
          <tr>
            <th>Prompt</th>
            <th>Response</th>
            <th>Evidence Focus</th>
            <th>Teacher Note</th>
          </tr>
        </thead>
        <tbody>
          ${row.run.teacher_probe.probe_items.map((item) => `
            <tr>
              <td>${escapeHtml(item.prompt)}</td>
              <td>${escapeHtml(formatProbeResponseMode(item.response_mode))}</td>
              <td>${escapeHtml(item.evidence_code)}</td>
              <td>${escapeHtml(item.teacher_note || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `)
    .join("");

  const overall = state.session.overall_summary || { observed_operating_year: "Insufficient Data", confidence: "Low" };
  const nextSteps = buildFinalNextSteps(
    state.session.section_runs.map((run) => run.summary).filter(Boolean)
  );
  const timestamp = formatReportTimestamp(state.session.generated_at || new Date().toISOString());

  const html = buildTeacherReportHtml({
    title: `${phase} Snapshot Teacher Report`,
    subtitle: `${phase} | Full Session`,
    metaRows: [
      ["Generated", timestamp],
      ["Teacher", state.session.teacher.name],
      ["Student", state.session.student.name],
      ["Phase", phase],
      ["Sections Completed", `${completedSections}/${sectionReportRows.length}`],
      ["Overall NZC Best-Fit", formatTeacherYearLabel(overall.observed_operating_year)],
      ["Confidence", overall.confidence]
    ],
    bodyHtml: `
      <h3>Sections</h3>
      <table>
        <thead>
          <tr>
            <th>Section</th>
            <th>NZC Best-Fit</th>
            <th>Confidence</th>
            <th>Likely Issue</th>
            <th>Start Here</th>
            <th>Probe</th>
          </tr>
        </thead>
        <tbody>${summaryRows}</tbody>
      </table>
      ${probeBlocks ? `<h3>Teacher Probe Notes</h3>${probeBlocks}` : ""}
      <h3>Strand Summary</h3>
      <table>
        <thead>
          <tr>
            <th>Strand</th>
            <th>Observed Year</th>
            <th>Confidence</th>
            <th>Supporting Sections</th>
          </tr>
        </thead>
        <tbody>
          ${state.session.strand_summary
            .map((strand) => `
              <tr>
                <td>${escapeHtml(strand.strand_name)}</td>
                <td>${escapeHtml(formatTeacherYearLabel(strand.observed_year_level))}</td>
                <td>${escapeHtml(strand.confidence)}</td>
                <td>${escapeHtml(strand.supporting_sections.join(", "))}</td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>
      <h3>Priority Next Steps</h3>
      <ul>${nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>
      <p style="font-size:0.82rem;color:#6b7280;margin-top:1.2rem;border-top:1px solid #e5e7eb;padding-top:0.8rem;"><strong>Confidence rating:</strong> High = student reached the observed level and also showed a non-secure result one level higher. Medium = usable evidence but without that upper boundary. Low = too few attempts or too many skips to be certain.</p>
    `
  });

  openPdfPrintWindow(html, `${safeFileBase()}_teacher_report`);
}

function downloadJsonExport() {
  const payload = buildSessionResult();
  downloadTextFile(
    `${safeFileBase()}_session_result.json`,
    `${JSON.stringify(payload, null, 2)}\n`,
    "application/json"
  );
}

function downloadCsvExport() {
  downloadTextFile(
    `${safeFileBase()}_session_results.csv`,
    buildDetailedCsvExport(),
    "text/csv;charset=utf-8"
  );
}

function buildTeacherReportHtml({ title, subtitle, metaRows, bodyHtml }) {
  const meta = metaRows
    .map(([label, value]) => `<div class="meta-row"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`)
    .join("");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: "Trebuchet MS", sans-serif; color: #1f2a44; margin: 20px; }
          h1 { margin: 0 0 6px; font-family: Georgia, serif; }
          h2 { margin: 0 0 14px; font-weight: 600; font-size: 1rem; color: #425a54; }
          h3 { margin: 18px 0 8px; font-size: 1rem; }
          .meta { display: grid; gap: 6px; margin: 10px 0 14px; }
          .meta-row { font-size: 0.93rem; }
          table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
          th, td { border: 1px solid #c9d0ca; text-align: left; padding: 7px; vertical-align: top; }
          th { background: #eef3ef; }
          ul { margin-top: 8px; }
          @page { margin: 14mm; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <h2>${escapeHtml(subtitle)}</h2>
        <section class="meta">${meta}</section>
        ${bodyHtml}
      </body>
    </html>
  `;
}

function openPdfPrintWindow(html, reportName) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Pop-up blocked. Allow pop-ups to generate the PDF report.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.document.title = reportName;
  win.focus();
  win.setTimeout(() => {
    win.print();
  }, 250);
}

function getNextStepForSection(section, summary) {
  const topic = section?.topic || summary.section_title;
  const bestFitYear = formatTeacherYearLabel(summary.observed_year_level);

  if (summary.observed_year_level === "Not Attempted") {
    return [`Schedule this section for evidence in ${topic}.`];
  }

  if (summary.mastery_band === "Secure") {
    return [
      `Extend into the next year-level tasks for ${topic}.`,
      "Use one rich problem-solving activity to confirm transfer."
    ];
  }

  if (summary.mastery_band === "Developing") {
    return [
      `Target misconceptions in ${topic} at ${bestFitYear}.`,
      "Re-check with 3-5 short follow-up questions next lesson."
    ];
  }

  return [
    summary.observed_year_level === PRE_PHASE_LABEL
      ? `Re-teach prerequisite skills for ${topic} prior to Year 4.`
      : `Re-teach prerequisite skills for ${topic} below ${bestFitYear}.`,
    "Use worked examples and guided practice before reassessment."
  ];
}

function buildFinalNextSteps(sectionSummaries) {
  const rank = { "Not Yet": 0, "Developing": 1, "Secure": 2 };
  const priorities = [...sectionSummaries]
    .sort((a, b) => (rank[a.mastery_band] - rank[b.mastery_band]) || (a.score_percent - b.score_percent))
    .slice(0, 4);

  return priorities.map((summary) => {
    const section = state.sectionsById.get(summary.section_id);
    const step = getNextStepForSection(section, summary)[0] || "";
    return `${sectionLabel(section)}: ${step}`;
  });
}

function formatReportTimestamp(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString();
}

function buildSessionResult() {
  return {
    schema_version: "1.1.0",
    assessment_id: state.bank.assessment.assessment_id,
    session_id: state.session.session_id,
    generated_at: state.session.generated_at,
    teacher: state.session.teacher,
    student: state.session.student,
    section_year_levels: state.session.section_runs
      .map((run) => run.summary)
      .filter(Boolean)
      .map((summary) => ({
        section_id: summary.section_id,
        section_title: summary.section_title,
        strand: summary.strand,
        target_year_variant: summary.target_year_variant,
        attempts: summary.attempts,
        observed_year_level: summary.observed_year_level,
        score_percent: summary.score_percent,
        mastery_band: summary.mastery_band,
        confidence: summary.confidence,
        diagnostic_summary: state.session.section_runs.find((run) => run.section_id === summary.section_id)?.diagnostic_summary || null,
        teacher_probe: state.session.section_runs.find((run) => run.section_id === summary.section_id)?.teacher_probe || {
          status: "not_run",
          probe_items: [],
          language_checks: [],
          teacher_summary: ""
        },
        teacher_override: {
          enabled: false,
          reason: ""
        }
      })),
    strand_summary: state.session.strand_summary,
    overall_summary: state.session.overall_summary,
    notes: [
      "Formative snapshot evidence only.",
      "Not standardised or norm referenced."
    ]
  };
}

function buildSectionReportRows() {
  const runs = state.session?.section_runs || [];
  return runs.map((run) => ({
    run,
    section: state.sectionsById.get(run.section_id),
    summary: run.summary || null
  }));
}

function buildQaRecords(runs) {
  const records = [];

  for (const run of runs) {
    const summary = run.summary;
    if (!summary) {
      continue;
    }

    const section = state.sectionsById.get(run.section_id);
    const section_id = section?.section_id ?? run.section_id;
    const section_label = sectionLabel(section);
    const strand = section?.strand ?? summary.strand;

    for (const attempt of summary.attempts) {
      for (const itemResult of attempt.item_results) {
        const item = state.itemsById.get(itemResult.item_id);
        records.push({
          section_id,
          section_label,
          strand,
          attempt_year_level: attempt.year_level,
          item_id: itemResult.item_id,
          prompt: item?.prompt ?? "",
          expected_answer: formatAnswerForExport(item?.answer),
          student_response: formatAnswerForExport(itemResult.response),
          is_correct: itemResult.is_correct,
          is_skipped: itemResult.is_skipped
        });
      }
    }
  }

  return records;
}

function buildAnalyticsSummaryFromRuns(runs) {
  const records = buildQaRecords(runs);
  const sectionsRun = runs.filter((run) => run.summary).length;
  const questionsTotal = records.length;
  const questionsAnswered = records.filter((record) => !record.is_skipped).length;
  const correctAnswers = records.filter((record) => record.is_correct).length;

  return {
    sections_run: sectionsRun,
    questions_total: questionsTotal,
    questions_answered: questionsAnswered,
    correct_answers: correctAnswers,
    accuracy_all_pct: questionsTotal ? round((correctAnswers / questionsTotal) * 100, 2) : 0,
    accuracy_answered_pct: questionsAnswered ? round((correctAnswers / questionsAnswered) * 100, 2) : 0
  };
}

function buildDetailedCsvExport() {
  const headers = [
    "session_id",
    "generated_at",
    "teacher_name",
    "student_name",
    "overall_year",
    "overall_confidence",
    "section_id",
    "section_title",
    "strand",
    "section_observed_year",
    "section_mastery_band",
    "section_confidence",
    "section_correct_answers",
    "section_total_questions",
    "section_likely_misconception",
    "section_last_secure_skill",
    "section_probe_status",
    "attempt_year_level",
    "item_id",
    "prompt",
    "expected_answer",
    "student_response",
    "is_correct",
    "is_skipped"
  ];
  const rows = [];

  for (const run of state.session.section_runs) {
    if (!run.summary) {
      continue;
    }

    const section = state.sectionsById.get(run.section_id);
    const diagnosticSummary = run.diagnostic_summary || buildDiagnosticSummary(section, run.summary);
    for (const attempt of run.summary.attempts) {
      for (const itemResult of attempt.item_results) {
        const item = state.itemsById.get(itemResult.item_id);
        rows.push({
          session_id: state.session.session_id,
          generated_at: state.session.generated_at || "",
          teacher_name: state.session.teacher.name || "",
          student_name: state.session.student.name || "",
          overall_year: state.session.overall_summary?.observed_operating_year || "",
          overall_confidence: state.session.overall_summary?.confidence || "",
          section_id: run.summary.section_id,
          section_title: sectionLabel(section),
          strand: run.summary.strand,
          section_observed_year: run.summary.observed_year_level,
          section_mastery_band: run.summary.mastery_band,
          section_confidence: run.summary.confidence,
          section_correct_answers: run.summary.correct_answers,
          section_total_questions: run.summary.total_questions,
          section_likely_misconception: diagnosticSummary.likely_misconception,
          section_last_secure_skill: diagnosticSummary.last_secure_skill,
          section_probe_status: run.teacher_probe?.status || diagnosticSummary.teacher_probe_status,
          attempt_year_level: yearLabelForDisplay(attempt.year_level),
          item_id: itemResult.item_id,
          prompt: item?.prompt ?? "",
          expected_answer: formatAnswerForExport(item?.answer),
          student_response: formatAnswerForExport(itemResult.response),
          is_correct: itemResult.is_correct,
          is_skipped: itemResult.is_skipped
        });
      }
    }
  }

  return toCsv(headers, rows);
}

function formatAnswerForExport(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    if ("whole" in value || "numerator" in value || "denominator" in value) {
      const whole = String(value.whole ?? "").trim();
      const numerator = String(value.numerator ?? "").trim();
      const denominator = String(value.denominator ?? "").trim();
      if (!whole && !numerator && !denominator) {
        return "";
      }
      if (whole && !numerator && !denominator) {
        return whole;
      }
      if (!whole && !denominator) {
        return numerator;
      }
      if (whole) {
        return denominator ? `${whole} ${numerator}/${denominator}` : whole;
      }
      return `${numerator}/${denominator}`;
    }

    const expandedKeys = Object.keys(value)
      .filter((key) => /^exp\d+$/.test(key))
      .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
    if (expandedKeys.length) {
      const parts = expandedKeys.map((key) => String(value[key] ?? "").trim()).filter(Boolean);
      return parts.join(" + ");
    }

    return JSON.stringify(value);
  }

  return String(value);
}

function safeFileBase() {
  const name = String(state.session?.student?.name || "").trim();
  return name ? name.replace(/\s+/g, "_") : "student";
}

function buildAssessmentHeaderContext(attemptNumber, attemptYearLabel) {
  const chips = [];
  const studentName = String(state.session?.student?.name || "").trim();
  const teacherName = String(state.session?.teacher?.name || "").trim();

  if (studentName) {
    chips.push(`<span class="nav-chip"><strong>Student:</strong> ${escapeHtml(studentName)}</span>`);
  }
  if (teacherName) {
    chips.push(`<span class="nav-chip"><strong>Teacher:</strong> ${escapeHtml(teacherName)}</span>`);
  }

  chips.push(`<span class="nav-chip"><strong>Pass:</strong> ${attemptNumber}</span>`);
  chips.push(`<span class="nav-chip"><strong>Year Level:</strong> ${escapeHtml(attemptYearLabel)}</span>`);
  chips.push(`<span class="nav-chip"><strong>Saved:</strong> ${escapeHtml(formatSavedAt(state.session?.last_saved_at))}</span>`);
  return chips.join("");
}

function buildSessionHeaderContext() {
  const chips = [];
  const studentName = String(state.session?.student?.name || "").trim();
  const teacherName = String(state.session?.teacher?.name || "").trim();
  if (studentName) {
    chips.push(`<span class="nav-chip"><strong>Student:</strong> ${escapeHtml(studentName)}</span>`);
  }
  if (teacherName) {
    chips.push(`<span class="nav-chip"><strong>Teacher:</strong> ${escapeHtml(teacherName)}</span>`);
  }
  if (state.session?.last_saved_at) {
    chips.push(`<span class="nav-chip"><strong>Saved:</strong> ${escapeHtml(formatSavedAt(state.session.last_saved_at))}</span>`);
  }
  return chips.join("");
}

function getSessionId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}`;
}

// ── LocalStorage helpers ──────────────────────────────────────────────────────
const STORAGE_KEY = "maths_snapshot_session_v1";
const HISTORY_KEY = "maths_snapshot_history_v2";

function saveSessionToStorage() {
  if (!state.session) return;
  try {
    state.session.last_saved_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.session));
  } catch (_) {}
}

function loadSidebarPreference() {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw);
    return !!parsed.sidebar_collapsed;
  } catch (_) {
    return false;
  }
}

function saveSidebarPreference(collapsed) {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ sidebar_collapsed: !!collapsed }));
  } catch (_) {}
}

function clearSessionFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

function loadSessionFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function saveCompletedSessionToHistory() {
  if (!state.session?.generated_at) {
    return;
  }
  try {
    const all = loadSessionHistoryFromStorage();
    const summary = buildStoredSessionSummary();
    const filtered = all.filter((entry) => entry.session_id !== summary.session_id);
    filtered.unshift(summary);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 20)));
  } catch (_) {}
}

function buildStoredSessionSummary() {
  const sectionSummaries = state.session.section_runs
    .map((run) => run.summary)
    .filter(Boolean);
  return {
    session_id: state.session.session_id,
    generated_at: state.session.generated_at,
    student_name: state.session.student?.name || "",
    teacher_name: state.session.teacher?.name || "",
    overall_year: state.session.overall_summary?.observed_operating_year || "Insufficient Data",
    confidence: state.session.overall_summary?.confidence || "Low",
    sections_completed: sectionSummaries.length,
    section_count: state.session.section_runs.length,
    session_payload: JSON.parse(JSON.stringify(state.session))
  };
}

function loadSessionHistoryFromStorage() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function clearSessionHistoryFromStorage() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (_) {}
}

function saveHistoryNames(sessionId) {
  if (!sessionId) {
    return;
  }

  const studentInput = document.querySelector(`[data-history-student="${CSS.escape(sessionId)}"]`);
  const teacherInput = document.querySelector(`[data-history-teacher="${CSS.escape(sessionId)}"]`);
  const studentName = String(studentInput?.value || "").trim();
  const teacherName = String(teacherInput?.value || "").trim();

  try {
    const history = loadSessionHistoryFromStorage();
    const entry = history.find((item) => item.session_id === sessionId);
    if (!entry) {
      return;
    }
    if (studentName) {
      entry.student_name = studentName;
      if (entry.session_payload?.student) {
        entry.session_payload.student.name = studentName;
      }
    }
    if (teacherName) {
      entry.teacher_name = teacherName;
      if (entry.session_payload?.teacher) {
        entry.session_payload.teacher.name = teacherName;
      }
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    if (state.session?.session_id === sessionId) {
      if (studentName) {
        state.session.student.name = studentName;
      }
      if (teacherName) {
        state.session.teacher.name = teacherName;
      }
      saveSessionToStorage();
    }
  } catch (_) {
    return;
  }

  renderSetup();
}

function openHistorySession(sessionId) {
  if (!sessionId) {
    return;
  }

  const history = loadSessionHistoryFromStorage();
  const entry = history.find((item) => item.session_id === sessionId);
  if (!entry?.session_payload) {
    alert("This saved report was stored before reopen support was added, so only the summary row is available.");
    return;
  }

  state.session = JSON.parse(JSON.stringify(entry.session_payload));
  state.ui.review_section_id = findLatestSectionSummaryRun()?.section_id || null;
  saveSessionToStorage();

  if (state.session.generated_at) {
    renderResultsFromSession();
    return;
  }

  if (state.session.current_attempt) {
    renderAssessment();
    return;
  }

  if (state.session.current_probe_section_id) {
    const probeRun = findCurrentProbeRun();
    if (probeRun) {
      renderTeacherProbe(probeRun);
      return;
    }
  }

  const run = findReviewSectionRun();
  if (run) {
    const hasNextSection = state.session.current_section_index < state.session.section_runs.length - 1;
    if (hasNextSection) {
      moveToNextSection();
      return;
    }
    startTeacherProbeFlowOrFinalize();
    return;
  }

  renderSetup();
}

function saveReportNamesFromResults() {
  const studentInput = document.getElementById("resultsStudentNameInput");
  const teacherInput = document.getElementById("resultsTeacherNameInput");
  if (!studentInput || !teacherInput || !state.session) {
    return;
  }

  state.session.student.name = studentInput.value.trim();
  state.session.teacher.name = teacherInput.value.trim();
  saveSessionToStorage();
  if (state.session.generated_at) {
    saveCompletedSessionToHistory();
  }
  renderResultsFromSession();
}

function formatTeacherYearLabel(value) {
  if (value === PRE_PHASE_LABEL) {
    return `Below Y${PHASE_MIN_YEAR}`;
  }

  if (typeof value === "number") {
    const year = Number(value);
    if (!Number.isFinite(year)) {
      return "";
    }
    return year < PHASE_MIN_YEAR ? `Y${year} question set` : `Y${year}`;
  }

  return String(value ?? "");
}

function describeAttemptBand(band) {
  if (band === "Secure") {
    return "Level met";
  }
  if (band === "Developing") {
    return "Partial success";
  }
  return "Needs earlier content";
}

function describeAttemptProgress(band) {
  if (band === "Secure") {
    return "Moved up to a harder year level after this attempt.";
  }
  if (band === "Developing") {
    return "Stopped here because this level still needs support.";
  }
  return "Moved down or stopped because earlier skills are still needed.";
}

function getSummaryAttemptContext(summary) {
  const attempts = [...(summary?.attempts || [])].sort((a, b) => a.year_level - b.year_level);
  const observedYear = parseYearLabel(summary?.observed_year_level);
  const observedAttempt = Number.isFinite(observedYear)
    ? attempts.find((attempt) => attempt.year_level === observedYear) ?? null
    : null;
  const upperAttempt = observedAttempt
    ? attempts.find((attempt) => attempt.year_level === observedAttempt.year_level + 1)
      ?? attempts.find((attempt) => attempt.year_level > observedAttempt.year_level)
      ?? null
    : null;
  const lowerSecureAttempt = observedAttempt
    ? [...attempts]
      .reverse()
      .find((attempt) => attempt.year_level < observedAttempt.year_level && attempt.mastery_band === "Secure")
      ?? null
    : null;
  const lowestAttempt = attempts[0] ?? null;

  return {
    attempts,
    observedAttempt,
    upperAttempt,
    lowerSecureAttempt,
    lowestAttempt
  };
}

function formatStudentResponseForReport(response) {
  const formatted = formatAnswerForExport(response);
  return String(formatted || "").trim() ? formatted : "No response";
}

function buildBlockingItemEvidence(attempt, limit = 6) {
  if (!attempt?.item_results?.length) {
    return [];
  }

  return attempt.item_results
    .filter((itemResult) => !itemResult.is_correct)
    .slice(0, limit)
    .map((itemResult) => {
      const item = state.itemsById.get(itemResult.item_id);
      return {
        yearLabel: formatTeacherYearLabel(attempt.year_level),
        prompt: item?.prompt ?? itemResult.item_id,
        expected: formatAnswerForExport(item?.answer),
        response: formatStudentResponseForReport(itemResult.response),
        issue: itemResult.is_skipped ? "Skipped" : "Incorrect"
      };
    });
}

function getNextAvailableYearLabel(summary, currentYearLevel) {
  const section = state.sectionsById.get(summary?.section_id);
  const nextYear = availableYears(section).find((year) => year > currentYearLevel);
  return nextYear ? formatTeacherYearLabel(nextYear) : null;
}

function buildSectionAllocationEvidence(summary) {
  if (!summary || summary.observed_year_level === "Not Attempted") {
    return {
      allocationLines: ["No questions were completed in this section."],
      barrierHeading: "What stopped progress",
      barrierIntro: "No boundary evidence is available yet.",
      barrierItems: []
    };
  }

  const bestFitYear = formatTeacherYearLabel(summary.observed_year_level);
  const {
    observedAttempt,
    upperAttempt,
    lowerSecureAttempt,
    lowestAttempt
  } = getSummaryAttemptContext(summary);

  if (summary.mastery_band === "Secure" && observedAttempt) {
    const allocationLines = [
      `${bestFitYear} was secured with ${observedAttempt.correct}/${observedAttempt.total} correct (${observedAttempt.score_percent}%).`
    ];

    if (upperAttempt) {
      allocationLines.push(
        `${formatTeacherYearLabel(upperAttempt.year_level)} was then not secured with ${upperAttempt.correct}/${upperAttempt.total} correct (${upperAttempt.score_percent}%), which confirms ${bestFitYear} as the current boundary in this section.`
      );
    } else {
      allocationLines.push(`No higher year-level evidence was collected after ${bestFitYear}, so this is the highest secure evidence in this section.`);
    }

    return {
      allocationLines,
      barrierHeading: upperAttempt
        ? `What stopped movement beyond ${bestFitYear}`
        : `What still needs checking beyond ${bestFitYear}`,
      barrierIntro: upperAttempt
        ? `${formatTeacherYearLabel(upperAttempt.year_level)} was the next year-level in the phase. The items below were incorrect or skipped and stopped the student from progressing further in this section.`
        : "A higher year level was not attempted, so there is no direct blocking evidence yet.",
      barrierItems: upperAttempt ? buildBlockingItemEvidence(upperAttempt) : []
    };
  }

  if (summary.mastery_band === "Developing" && observedAttempt) {
    const allocationLines = [];

    if (lowerSecureAttempt) {
      allocationLines.push(
        `${formatTeacherYearLabel(lowerSecureAttempt.year_level)} was secured with ${lowerSecureAttempt.correct}/${lowerSecureAttempt.total} correct (${lowerSecureAttempt.score_percent}%).`
      );
    }

    allocationLines.push(
      `${bestFitYear} was only partly met with ${observedAttempt.correct}/${observedAttempt.total} correct (${observedAttempt.score_percent}%), so the student is working within ${bestFitYear} but is not yet secure there.`
    );

    if (upperAttempt) {
      allocationLines.push(
        `${formatTeacherYearLabel(upperAttempt.year_level)} was not met with ${upperAttempt.correct}/${upperAttempt.total} correct (${upperAttempt.score_percent}%), which supports keeping the allocation at ${bestFitYear}.`
      );
    }

    const barrierAttempt = upperAttempt ?? observedAttempt;
    const nextYear = upperAttempt
      ? formatTeacherYearLabel(upperAttempt.year_level)
      : getNextAvailableYearLabel(summary, observedAttempt.year_level);

    return {
      allocationLines,
      barrierHeading: nextYear
        ? `What stopped movement to ${nextYear}`
        : `What still needs securing at ${bestFitYear}`,
      barrierIntro: upperAttempt
        ? `The next year-level evidence came from ${nextYear}. These incorrect or skipped responses prevented the student from moving up.`
        : nextYear
          ? `The student was not yet secure at ${bestFitYear}. These incorrect or skipped responses show what needs to be fixed before moving to ${nextYear}.`
          : `The student is still not secure at ${bestFitYear}. These incorrect or skipped responses explain why the allocation remains there.`,
      barrierItems: buildBlockingItemEvidence(barrierAttempt)
    };
  }

  if (lowestAttempt) {
    const phaseEntryYear = formatTeacherYearLabel(PHASE_MIN_YEAR);
    return {
      allocationLines: [
        `${formatTeacherYearLabel(lowestAttempt.year_level)} was not met with ${lowestAttempt.correct}/${lowestAttempt.total} correct (${lowestAttempt.score_percent}%).`,
        `This indicates prerequisite knowledge below ${phaseEntryYear}, so the student is currently working below the phase entry point in this section.`
      ],
      barrierHeading: `What stopped entry into ${phaseEntryYear}`,
      barrierIntro: `These incorrect or skipped responses show why the student could not yet move into ${phaseEntryYear} in this phase.`,
      barrierItems: buildBlockingItemEvidence(lowestAttempt)
    };
  }

  return {
    allocationLines: ["Use the attempt history below as the current evidence for this allocation."],
    barrierHeading: "What stopped progress",
    barrierIntro: "No blocking item evidence is available.",
    barrierItems: []
  };
}

function buildSectionDecision(summary) {
  if (!summary || summary.observed_year_level === "Not Attempted") {
    return {
      bestFitYear: "Not attempted",
      headline: "No year-level decision yet.",
      evidence: "No questions were completed in this section.",
      shortReason: "No evidence collected yet."
    };
  }

  const { attempts, observedAttempt, upperAttempt, lowerSecureAttempt, lowestAttempt } = getSummaryAttemptContext(summary);
  const bestFitYear = formatTeacherYearLabel(summary.observed_year_level);

  if (summary.mastery_band === "Secure" && observedAttempt) {
    const observedYearLabel = formatTeacherYearLabel(observedAttempt.year_level);
    return {
      bestFitYear,
      headline: `Working at ${bestFitYear} in this section.`,
      evidence: upperAttempt
        ? `${observedYearLabel} was met with ${observedAttempt.correct}/${observedAttempt.total} correct, but ${formatTeacherYearLabel(upperAttempt.year_level)} was not met (${upperAttempt.correct}/${upperAttempt.total}), so ${bestFitYear} is the best-fit level.`
        : `${observedYearLabel} was met with ${observedAttempt.correct}/${observedAttempt.total} correct, so ${bestFitYear} is the strongest year-level evidence collected in this section.`,
      shortReason: upperAttempt
        ? `${observedYearLabel} met (${observedAttempt.correct}/${observedAttempt.total}); ${formatTeacherYearLabel(upperAttempt.year_level)} not met (${upperAttempt.correct}/${upperAttempt.total}).`
        : `${observedYearLabel} met (${observedAttempt.correct}/${observedAttempt.total}).`
    };
  }

  if (summary.mastery_band === "Developing" && observedAttempt) {
    const observedYearLabel = formatTeacherYearLabel(observedAttempt.year_level);
    const clauses = [];

    if (lowerSecureAttempt) {
      clauses.push(`${formatTeacherYearLabel(lowerSecureAttempt.year_level)} was met (${lowerSecureAttempt.correct}/${lowerSecureAttempt.total})`);
    }

    clauses.push(`${observedYearLabel} was partly met (${observedAttempt.correct}/${observedAttempt.total})`);

    if (upperAttempt) {
      clauses.push(`${formatTeacherYearLabel(upperAttempt.year_level)} was not met (${upperAttempt.correct}/${upperAttempt.total})`);
    }

    return {
      bestFitYear,
      headline: `Working at ${bestFitYear} in this section, with support still needed.`,
      evidence: `${clauses.join(". ")}. Place the student at ${bestFitYear} for now, but this level is not secure yet.`,
      shortReason: [
        lowerSecureAttempt ? `${formatTeacherYearLabel(lowerSecureAttempt.year_level)} met` : "",
        `${observedYearLabel} partly met (${observedAttempt.correct}/${observedAttempt.total})`,
        upperAttempt ? `${formatTeacherYearLabel(upperAttempt.year_level)} not met (${upperAttempt.correct}/${upperAttempt.total})` : ""
      ].filter(Boolean).join("; ") + "."
    };
  }

  if (lowestAttempt) {
    const lowestYearLabel = formatTeacherYearLabel(lowestAttempt.year_level);
    return {
      bestFitYear,
      headline: `Working below Y${PHASE_MIN_YEAR} in this section.`,
      evidence: `${lowestYearLabel} was not met (${lowestAttempt.correct}/${lowestAttempt.total}), so earlier prerequisite skills are still needed.`,
      shortReason: `${lowestYearLabel} not met (${lowestAttempt.correct}/${lowestAttempt.total}); needs earlier skills.`
    };
  }

  return {
    bestFitYear,
    headline: `Working at ${bestFitYear} in this section.`,
    evidence: "Use the attempt history below as the current evidence for this decision.",
    shortReason: "See attempt history."
  };
}

function getCurrentRun() {
  return state.session.section_runs[state.session.current_section_index] || null;
}

function getSortedSections() {
  return [...state.bank.sections].sort((a, b) => {
    if (a.section_number !== b.section_number) {
      return a.section_number - b.section_number;
    }
    return sectionLabel(a).localeCompare(sectionLabel(b));
  });
}

function sectionLabel(section) {
  if (!section) {
    return "Unknown section";
  }
  return section.part
    ? `${section.section_number}${section.part}. ${section.title}`
    : `${section.section_number}. ${section.title}`;
}

function availableYears(section) {
  return section.variants
    .map((variant) => variant.year_level)
    .sort((a, b) => a - b);
}

function nearestAvailableYear(years, requestedYear) {
  if (years.includes(requestedYear)) {
    return requestedYear;
  }
  return years.reduce((closest, year) =>
    Math.abs(year - requestedYear) < Math.abs(closest - requestedYear) ? year : closest
  );
}

function getVariantByYear(section, year) {
  return section.variants.find((variant) => variant.year_level === year);
}

function reduceConfidence(levels) {
  if (!levels.length) {
    return "Low";
  }
  if (levels.includes("Low")) {
    return "Low";
  }
  if (levels.includes("Medium")) {
    return "Medium";
  }
  return "High";
}

function parseYearLabel(value) {
  const prePhaseMatch = String(value).match(/pre-y(\d+)/i);
  if (prePhaseMatch) {
    return Number(prePhaseMatch[1]) - 0.5;
  }
  const match = String(value).match(/Y(\d+)/);
  return match ? Number(match[1]) : null;
}

function yearLabelForDisplay(yearLevel) {
  const year = Number(yearLevel);
  if (!Number.isFinite(year)) {
    return "";
  }
  if (year < PHASE_MIN_YEAR) {
    return PRE_PHASE_LABEL;
  }
  return `Y${year}`;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatSavedAt(isoString) {
  if (!isoString) {
    return "Not yet";
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function normalizeInput(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function isBlank(value) {
  if (typeof value === "string") {
    return !value.trim();
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).every((fieldValue) => !String(fieldValue || "").trim());
  }

  return value === null || value === undefined;
}

function normalizeLiteral(value) {
  return expandUnicodeFractions(String(value ?? ""))
    .toLowerCase()
    .trim()
    .replace(/,/g, "")
    .replace(/\b(remainder|rem)\b/g, "r")
    .replace(/\b(equals?|equivalent|same)\b/g, "=")
    .replace(/\s*([+\-=/%])\s*/g, "$1")
    .replace(/(\d)\s*r\s*(\d+)/g, "$1r$2")
    .replace(/\s+/g, " ")
    .trim();
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function toCsv(headers, rows) {
  const csvLines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    csvLines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  return `${csvLines.join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
