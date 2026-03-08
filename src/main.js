const PHASE_CONFIGS = {
  phase1: {
    key: "phase1",
    label: "Phase 1",
    subtitle: "Y0-3 Snapshot",
    data_url: new URL("../data/phase1-question-bank.json", import.meta.url),
    default_start_mode: "from_floor",
    default_start_year: 0,
    floor_label: "Start from 6 months and build upon",
    specified_years: [0, 1, 2, 3]
  },
  phase2: {
    key: "phase2",
    label: "Phase 2",
    subtitle: "Y4-6 Snapshot",
    data_url: new URL("../data/phase2-question-bank.json", import.meta.url),
    default_start_mode: "from_floor",
    default_start_year: 3,
    floor_label: "Start from Pre-Year 4 check (Y3 question set) and build upon",
    specified_years: [3, 4, 5, 6]
  }
};

const STRAND_WEIGHTS = {
  "Number Structure": 0.2,
  "Number Operations": 0.4,
  "Rational Numbers": 0.4
};
const UI_STORAGE_KEY = "maths_snapshot_ui_v1";

const state = {
  banksByPhase: new Map(),
  bank: null,
  itemsById: new Map(),
  sectionsById: new Map(),
  session: null,
  notice: "",
  ui: {
    sidebar_collapsed: loadSidebarPreference(),
    show_history_panel: false,
    review_section_id: null,
    current_phase: loadCurrentPhasePreference()
  }
};

const app = document.getElementById("app");

init();

async function init() {
  try {
    for (const config of Object.values(PHASE_CONFIGS)) {
      const response = await fetch(config.data_url);
      if (!response.ok) {
        throw new Error(`Could not load question bank for ${config.label} (${response.status})`);
      }
      const bank = await response.json();
      validateBankShape(bank);
      state.banksByPhase.set(config.key, bank);
    }
    activatePhase(state.ui.current_phase, { rerender: false });
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

function getCurrentPhaseConfig() {
  return PHASE_CONFIGS[state.ui.current_phase] || PHASE_CONFIGS.phase2;
}

function getPhaseMinYear() {
  const min = Number(state.bank?.assessment?.intended_year_range?.min);
  return Number.isFinite(min) ? min : 4;
}

function getPrePhaseLabel() {
  return state.ui.current_phase === "phase2"
    ? `Pre-Y${getPhaseMinYear()} (Y3 question set)`
    : "";
}

function activatePhase(phaseKey, options = {}) {
  const { rerender = true } = options;
  const config = PHASE_CONFIGS[phaseKey] || PHASE_CONFIGS.phase2;
  const bank = state.banksByPhase.get(config.key);
  if (!bank) {
    throw new Error(`Question bank for ${config.label} is not loaded.`);
  }

  state.ui.current_phase = config.key;
  saveCurrentPhasePreference(config.key);
  state.bank = bank;
  state.itemsById = new Map(bank.items.map((item) => [item.item_id, item]));
  state.sectionsById = new Map(bank.sections.map((section) => [section.section_id, section]));

  if (rerender) {
    state.notice = "";
    state.session = null;
    clearSessionFromStorage();
    renderSetup();
  }
}

function onPhaseToggle(nextPhaseKey) {
  if (nextPhaseKey === state.ui.current_phase) {
    return;
  }

  const savedSession = loadSessionFromStorage();
  const hasInProgressSession = isSessionInProgress() || (!!savedSession && !savedSession.generated_at);
  if (hasInProgressSession) {
    const shouldLeave = window.confirm("Switch phase and discard this in-progress session?");
    if (!shouldLeave) {
      return;
    }
  }

  activatePhase(nextPhaseKey);
}

function renderPage(contentHtml, options = {}) {
  const {
    headerContextHtml = "",
    activeStep = "setup",
    shellMode = "teacher",
    lockSidebar = false
  } = options;
  const hasHeaderContext = headerContextHtml.trim().length > 0;
  const phaseConfig = getCurrentPhaseConfig();
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
    <div class="teacher-shell ${shellModeClass} ${collapsedClass} phase-${escapeAttribute(phaseConfig.key)}">
      <aside class="teacher-sidebar" aria-label="Teacher navigation">
        <div class="sidebar-brand">
          <span class="brand-mark" aria-hidden="true">${iconSvg("logo")}</span>
          <span class="brand-copy">
            <strong class="brand-title">Maths Snapshots</strong>
            <small class="brand-subtitle">${escapeHtml(phaseConfig.subtitle)}</small>
          </span>
        </div>

        <section class="phase-switcher" aria-label="Learning phase">
          <div class="phase-switcher-header">
            <strong>Learning Phase</strong>
            <small>${escapeHtml(phaseConfig.subtitle)}</small>
          </div>
          <button
            type="button"
            id="phaseToggleBtn"
            class="phase-toggle ${phaseConfig.key === "phase2" ? "is-phase2" : "is-phase1"}"
            role="switch"
            aria-checked="${phaseConfig.key === "phase2" ? "true" : "false"}"
            aria-label="Switch learning phase. Current phase ${escapeAttribute(phaseConfig.label)}"
          >
            <span class="phase-toggle-label phase-toggle-label-left">Phase 1</span>
            <span class="phase-toggle-track" aria-hidden="true">
              <span class="phase-toggle-thumb"></span>
            </span>
            <span class="phase-toggle-label phase-toggle-label-right">Phase 2</span>
          </button>
          <div class="phase-toggle-current" aria-live="polite">
            <strong>${escapeHtml(phaseConfig.label)}</strong>
            <small>${escapeHtml(phaseConfig.subtitle)}</small>
          </div>
        </section>

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
  const phaseToggle = document.getElementById("phaseToggleBtn");
  if (phaseToggle) {
    phaseToggle.addEventListener("click", () => {
      const nextPhaseKey = state.ui.current_phase === "phase1" ? "phase2" : "phase1";
      onPhaseToggle(nextPhaseKey);
    });
  }

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

function getAvailableStartYears() {
  const phaseConfig = getCurrentPhaseConfig();
  return phaseConfig.specified_years;
}

function formatSetupYearLabel(year) {
  if (state.ui.current_phase === "phase1") {
    return year === 0 ? "6 months" : `Y${year}`;
  }
  if (state.ui.current_phase === "phase2" && year === 3) {
    return "Pre-Y4";
  }
  return `Y${year}`;
}

function renderSetup() {
  const sections = getSortedSections();
  const phaseConfig = getCurrentPhaseConfig();
  const startYears = getAvailableStartYears();
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
      <h1>${escapeHtml(state.bank?.assessment?.name || `${phaseConfig.label} Maths Snapshot`)}</h1>
      <p class="subtle">Select the sections you want to run, choose a starting year level, and enter names for the PDF report. Each section takes around 3–5 minutes. Hand the device to the student when ready.</p>
      ${historyPanel}

      <form id="setupForm" class="grid-form grid-form-setup">
        <fieldset class="start-mode start-mode-compact">
          <legend>Starting Questions</legend>
          <p class="subtle start-note">Chooses the first year-level questions shown for each section.</p>

          <label class="radio-row radio-choice">
            <input type="radio" name="startMode" value="from_floor" checked />
            <span>${escapeHtml(phaseConfig.floor_label)}</span>
          </label>

          <div class="radio-row radio-row-specified">
            <label class="radio-choice">
              <input type="radio" name="startMode" value="specified" />
              <span>Start from specified year</span>
            </label>
            <div id="specifiedYearWrap" class="specified-year-inline disabled" aria-label="Specified year options">
              ${startYears.map((year, index) => `
                <label class="year-check">
                  <input type="radio" name="startYear" value="${year}" ${index === 0 ? "checked" : ""} disabled />
                  <span>${escapeHtml(formatSetupYearLabel(year))}</span>
                </label>
              `).join("")}
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
      if (state.session?.phase_key && state.session.phase_key !== state.ui.current_phase) {
        activatePhase(state.session.phase_key, { rerender: false });
      }
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
    const defaultYear = yearInputs.find((input) => input.value === String(getCurrentPhaseConfig().specified_years[0])) || yearInputs[0];
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

  const phaseConfig = getCurrentPhaseConfig();
  const startMode = String(form.get("startMode") || phaseConfig.default_start_mode);
  const requestedStartYear = startMode === "specified"
    ? Number(form.get("startYear") || phaseConfig.specified_years[0])
    : phaseConfig.default_start_year;
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
    phase_key: phaseConfig.key,
    start_year: requestedStartYear,
    start_mode: startMode,
    selected_section_ids: selectedSectionIds,
    section_runs: sectionRuns,
    current_section_index: 0,
    current_attempt: null,
    current_probe_section_id: null,
    current_probe_item_index: -1,
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
  const teacherProbe = normalizeTeacherProbePlan(section, run.summary, diagnosticSummary, run.teacher_probe);
  const probeItems = teacherProbe.probe_items || [];
  const currentProbeIndex = Number(state.session.current_probe_item_index);
  const showingIntro = currentProbeIndex < 0;
  const probeIndex = Math.min(
    Math.max(currentProbeIndex || 0, 0),
    Math.max(probeItems.length - 1, 0)
  );
  const currentItem = probeItems[probeIndex];

  run.diagnostic_summary = diagnosticSummary;
  run.teacher_probe = teacherProbe;
  state.session.current_probe_section_id = run.section_id;
  state.session.current_probe_item_index = showingIntro ? -1 : probeIndex;
  saveSessionToStorage();

  const content = `
    <section class="panel">
      <h1>${escapeHtml(sectionLabel(section))} — Short Teacher Probe</h1>

      <form id="teacherProbeForm" class="teacher-probe-form">
        ${showingIntro
          ? `
            <article class="teacher-probe-intro">
              <p class="teacher-probe-intro-kicker">Teacher-only follow-up</p>
              <h2>Why this short probe appears</h2>
              <p>This section result needs a quick teacher check before the final report is locked in.</p>
              <ul class="teacher-probe-intro-list">
                <li>You will answer ${probeItems.length} short multiple-choice questions.</li>
                <li>This does not extend the student assessment.</li>
                <li>It helps separate maths misunderstanding from language load or task wording.</li>
                <li>Your choices feed directly into the final teacher report.</li>
              </ul>
            </article>
          `
          : `
            <div class="teacher-probe-progress">
              <div class="teacher-probe-progress-copy">
                <strong>Question ${probeIndex + 1} of ${probeItems.length}</strong>
                <span>${probeItems.filter((item) => item.selected_option).length} answered</span>
              </div>
              <div class="teacher-probe-progress-track" aria-hidden="true">
                ${probeItems.map((item, index) => `
                  <span class="teacher-probe-progress-dot ${index === probeIndex ? "is-current" : item.selected_option ? "is-complete" : ""}"></span>
                `).join("")}
              </div>
            </div>

            ${currentItem ? `
              <article class="teacher-probe-card">
                <h3>Probe ${probeIndex + 1}</h3>
                <p class="teacher-probe-prompt">${escapeHtml(currentItem.prompt)}</p>
                <div class="teacher-probe-options">
                  ${currentItem.response_options.map((option) => `
                    <label class="teacher-probe-option ${currentItem.selected_option === option.id ? "is-selected" : ""}">
                      <input
                        type="radio"
                        name="probeChoice"
                        value="${escapeAttribute(option.id)}"
                        ${currentItem.selected_option === option.id ? "checked" : ""}
                      />
                      <span>${escapeHtml(option.label)}</span>
                    </label>
                  `).join("")}
                </div>
              </article>
            ` : ""}
          `}

        <div class="actions-row">
          ${showingIntro
            ? `<button type="submit" name="probeAction" value="start" class="btn-primary btn-probe-start">Start Short Teacher Probe</button>`
            : `
              <button type="submit" name="probeAction" value="back" ${probeIndex === 0 ? "disabled" : ""}>Back</button>
              <button type="submit" name="probeAction" value="${probeIndex === probeItems.length - 1 ? "finish" : "next"}" class="btn-primary">
                ${probeIndex === probeItems.length - 1 ? "Save Probe & Continue" : "Next Question"}
              </button>
            `}
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
  const action = event.submitter?.value || "next";
  if (action === "start") {
    state.session.current_probe_item_index = 0;
    saveSessionToStorage();
    renderTeacherProbe(run);
    return;
  }

  const probeIndex = Math.min(
    Math.max(Number(state.session.current_probe_item_index) || 0, 0),
    Math.max(run.teacher_probe.probe_items.length - 1, 0)
  );
  const selectedOption = String(formData.get("probeChoice") || "");
  const currentItem = run.teacher_probe.probe_items[probeIndex];

  if (currentItem) {
    currentItem.selected_option = selectedOption;
    currentItem.selected_label = getProbeOptionLabel(currentItem, selectedOption);
  }

  if (action === "back") {
    state.session.current_probe_item_index = Math.max(probeIndex - 1, 0);
    if (probeIndex === 0) {
      state.session.current_probe_item_index = -1;
    }
    saveSessionToStorage();
    renderTeacherProbe(run);
    return;
  }

  if (action === "next" && probeIndex < run.teacher_probe.probe_items.length - 1) {
    state.session.current_probe_item_index = probeIndex + 1;
    saveSessionToStorage();
    renderTeacherProbe(run);
    return;
  }

  run.teacher_probe.teacher_summary = buildTeacherProbeSummary(run.teacher_probe);
  run.teacher_probe.status = "completed";
  if (run.diagnostic_summary) {
    run.diagnostic_summary.teacher_probe_status = "completed";
    run.diagnostic_summary.likely_misconception = refineMisconceptionFromProbe(run.diagnostic_summary.likely_misconception, run.teacher_probe);
  }
  state.session.current_probe_section_id = null;
  state.session.current_probe_item_index = -1;
  saveSessionToStorage();
  startTeacherProbeFlowOrFinalize();
}

function onTeacherProbeSkip() {
  const run = findCurrentProbeRun();
  if (run?.teacher_probe) {
    run.teacher_probe.status = "recommended";
  }
  state.session.current_probe_section_id = null;
  state.session.current_probe_item_index = -1;
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

  if (countSequenceMatch(item, response, expectedValue)) {
    return true;
  }

  return literalMatch(response, expectedValue);
}

function countSequenceMatch(item, response, expectedValue) {
  if (item?.answer_type !== "short_text") {
    return false;
  }

  const prompt = String(item?.prompt ?? "");
  if (!/^count\s+(forwards|backwards)\s+from\b/i.test(prompt)) {
    return false;
  }

  const expectedSequence = parseIntegerSequence(expectedValue);
  const responseSequence = parseIntegerSequence(response);
  if (!expectedSequence || !responseSequence) {
    return false;
  }

  if (integerSequencesEqual(responseSequence, expectedSequence)) {
    return true;
  }

  const startMatch = prompt.match(/count\s+(?:forwards|backwards)\s+from\s+(-?\d+)/i);
  if (!startMatch) {
    return false;
  }

  const startValue = Number(startMatch[1]);
  if (!Number.isInteger(startValue)) {
    return false;
  }

  if (integerSequencesEqual(responseSequence, [startValue, ...expectedSequence])) {
    return true;
  }

  const compactResponse = compactDigitSequence(response);
  if (!compactResponse) {
    return false;
  }

  return compactResponse === joinIntegerSequence(expectedSequence)
    || compactResponse === joinIntegerSequence([startValue, ...expectedSequence]);
}

function parseIntegerSequence(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const matches = raw.match(/-?\d+/g);
  if (!matches?.length) {
    return null;
  }

  const sequence = matches.map((part) => Number(part));
  return sequence.every((part) => Number.isInteger(part)) ? sequence : null;
}

function integerSequencesEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function joinIntegerSequence(values) {
  return values.map((value) => String(value)).join("");
}

function compactDigitSequence(value) {
  const compact = String(value ?? "").replace(/[^\d-]+/g, "");
  return compact.trim();
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
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+and\s+/g, " ")
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

  const raw = value.trim();
  const sanitized = raw
    .trim()
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/\s+/g, "");

  if (!sanitized) {
    return null;
  }

  const parsed = Number(sanitized);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  const extracted = extractSingleNumericToken(raw);
  if (extracted !== null) {
    return extracted;
  }

  return parseSpokenNumber(raw);
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
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+and\s+/g, " ")
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

  const spokenFraction = parseSpokenFraction(expanded);
  if (spokenFraction !== null) {
    return spokenFraction;
  }

  const numeric = Number(expanded.replace(/\s+/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function extractSingleNumericToken(value) {
  const matches = String(value ?? "")
    .replace(/,/g, "")
    .match(/-?\d+(?:\.\d+)?/g);

  if (!matches?.length || matches.length > 1) {
    return null;
  }

  const parsed = Number(matches[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSpokenNumber(value) {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const direct = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19
  };
  const tens = {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90
  };

  const tokens = normalized.split(" ");
  let total = 0;
  let current = 0;

  for (const token of tokens) {
    if (direct[token] !== undefined) {
      current += direct[token];
      continue;
    }
    if (tens[token] !== undefined) {
      current += tens[token];
      continue;
    }
    if (token === "hundred") {
      current = current === 0 ? 100 : current * 100;
      continue;
    }
    if (token === "thousand") {
      current = current === 0 ? 1000 : current * 1000;
      total += current;
      current = 0;
      continue;
    }
    return null;
  }

  return total + current;
}

function parseSpokenFraction(value) {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^\w\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const aliases = {
    half: "1/2",
    "one half": "1/2",
    quarter: "1/4",
    "one quarter": "1/4",
    "one fourth": "1/4",
    third: "1/3",
    "one third": "1/3",
    fifth: "1/5",
    "one fifth": "1/5",
    sixth: "1/6",
    "one sixth": "1/6",
    eighth: "1/8",
    "one eighth": "1/8"
  };

  const alias = aliases[normalized];
  if (!alias) {
    return null;
  }

  const [numerator, denominator] = alias.split("/").map(Number);
  return denominator ? numerator / denominator : null;
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
    observed_year_level = state.ui.current_phase === "phase2" ? getPrePhaseLabel() : yearLabelForDisplay(sorted[0]?.year_level ?? getPhaseMinYear());
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
      teacher_summary: ""
    };
  }

  const prompts = getTeacherProbePrompts(section, summary);
  return {
    status: "recommended",
    probe_items: prompts.map((prompt, index) => ({
      probe_id: `${section.section_id}_probe_${index + 1}`,
      prompt: prompt.prompt,
      evidence_code: prompt.evidence_code,
      response_options: prompt.response_options,
      selected_option: "",
      selected_label: ""
    })),
    teacher_summary: ""
  };
}

function normalizeTeacherProbePlan(section, summary, diagnosticSummary, teacherProbe) {
  if (!teacherProbe || !Array.isArray(teacherProbe.probe_items)) {
    return buildTeacherProbePlan(section, summary, diagnosticSummary);
  }

  const hasModernItems = teacherProbe.probe_items.every(
    (item) => Array.isArray(item.response_options)
  );
  if (!hasModernItems) {
    return buildTeacherProbePlan(section, summary, diagnosticSummary);
  }

  return {
    status: teacherProbe.status || (diagnosticSummary?.teacher_probe_needed ? "recommended" : "not_run"),
    probe_items: teacherProbe.probe_items.map((item) => ({
      ...item,
      response_options: Array.isArray(item.response_options) ? item.response_options : [],
      selected_option: String(item.selected_option || ""),
      selected_label: String(item.selected_label || getProbeOptionLabel(item, item.selected_option || ""))
    })),
    teacher_summary: String(teacherProbe.teacher_summary || "")
  };
}

function getTeacherProbePrompts(section, summary) {
  const phaseKey = state.ui.current_phase;
  const makeOption = (id, label, misconceptionHint = "") => ({
    id,
    label,
    ...(misconceptionHint ? { misconception_hint: misconceptionHint } : {})
  });
  const makePrompt = (prompt, evidenceCode, responseOptions) => ({
    prompt,
    evidence_code: evidenceCode,
    response_options: responseOptions
  });
  const generic = [
    makePrompt("What most likely sat behind the student errors in this section?", "likely_barrier", [
      makeOption("concept_gap", "The core maths idea is not secure yet.", "The core concept is not secure enough at this level yet."),
      makeOption("representation_only", "The student could explain it with materials but not with symbols.", "The written task may be overstating the gap because the student can show more understanding with materials."),
      makeOption("language_load", "The wording looked more difficult than the maths.", "The maths language may be masking what the student actually understands."),
      makeOption("not_clear", "It is still not clear from the short probe.")
    ]),
    makePrompt("Which support helped the student most?", "best_representation", [
      makeOption("materials", "Concrete materials or acted examples."),
      makeOption("diagram", "A diagram, chart, or number line."),
      makeOption("oral", "Teacher talk-through and oral questioning."),
      makeOption("none", "None yet; the student still seemed unsure.")
    ]),
    makePrompt("Which maths language still seemed shaky?", "language_comprehension", [
      makeOption("secure", "The key section words seemed secure."),
      makeOption("comparison", "Comparison / direction words such as before, after, more, less caused confusion.", "The student may need explicit teaching of comparison and direction language."),
      makeOption("place_value", "Place-value words such as digit, tens, hundreds, tenths caused confusion.", "The student may need explicit teaching of the place-value vocabulary in this section."),
      makeOption("task_words", "The task wording itself seemed to block the response.", "The wording load may be getting in the way of the maths thinking.")
    ]),
    makePrompt("Where would you start next?", "teaching_entry", [
      makeOption("step_back", "Step back to an easier prerequisite in this section."),
      makeOption("reteach_model", "Reteach the idea with modelling and think-aloud."),
      makeOption("guided_practice", "Give short guided practice on the same idea."),
      makeOption("not_sure", "Need one more observation before deciding.")
    ])
  ];

  const promptSets = {
    phase1: {
      sec_01: [
        makePrompt("What most likely caused the student to break in counting?", "likely_barrier", [
          makeOption("sequence", "The counting sequence itself is not secure yet.", "The student is still building a stable counting sequence."),
          makeOption("backward", "Forward counting is stronger than backward counting.", "The student may be relying on forward counting and not yet secure with counting backwards."),
          makeOption("crossing", "Crossing decade or hundred boundaries caused the problem.", "The student may lose the count sequence when crossing decade or hundred boundaries."),
          makeOption("attention", "The student knew some of it but lost attention or stamina.")
        ]),
        makePrompt("When the student was supported, what looked strongest?", "secure_floor", [
          makeOption("small_range", "Counting in a small range only."),
          makeOption("forward_only", "Counting forward only."),
          makeOption("objects", "Counting objects was easier than number words alone."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to cause the most trouble?", "language_comprehension", [
          makeOption("secure", "Words like before, after, next were secure."),
          makeOption("before_after", "Before / after language caused confusion.", "The student may not yet connect before and after language to counting direction."),
          makeOption("forwards_backwards", "Forwards / backwards language caused confusion.", "The student may need explicit teaching of forwards and backwards language."),
          makeOption("task_words", "The question wording itself caused confusion.", "The task wording may be obscuring the counting concept.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("oral_count", "Short oral counting bursts with teacher prompting."),
          makeOption("materials", "Count objects and move them while saying each number."),
          makeOption("number_line", "Use a number line to practise counting on and back."),
          makeOption("step_back", "Step back to a smaller counting range first.")
        ])
      ],
      sec_02: [
        makePrompt("What most likely caused the errors in identifying numbers?", "likely_barrier", [
          makeOption("numeral_recognition", "Reading number symbols is not secure yet.", "The student may not yet read written numbers quickly and reliably."),
          makeOption("before_after", "The student could read the number but not the number before or after.", "The student may know the written number but not yet connect it to the surrounding counting sequence."),
          makeOption("matching", "Matching the written number to the amount was the main issue.", "The student may need stronger links between written numbers and quantities."),
          makeOption("attention", "The student appeared inconsistent rather than conceptually stuck.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("recognise_small", "Reading smaller numbers only."),
          makeOption("say_not_find", "Saying numbers was easier than finding them."),
          makeOption("find_not_before_after", "Finding the number was easier than before/after tasks."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Number words and number names were secure."),
          makeOption("before_after", "Before / after was the main language issue.", "The student may need explicit teaching of before and after in number sequences."),
          makeOption("digit_number", "Digit / number language seemed mixed up.", "The student may be mixing up the ideas of digit and number."),
          makeOption("task_words", "The wording load itself seemed too high.", "The wording load may be affecting performance more than number knowledge.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("match_objects", "Match written numbers to sets and spoken number words."),
          makeOption("number_track", "Use a number track for before and after."),
          makeOption("flash_cards", "Practise quick number reading with cards."),
          makeOption("step_back", "Step back to a smaller set of numbers first.")
        ])
      ],
      sec_04: [
        makePrompt("What most likely caused the place-value errors?", "likely_barrier", [
          makeOption("grouping", "The student does not yet trust groups of ten and ones.", "The student may not yet see quantities as made of ones, tens, and hundreds."),
          makeOption("digit_positions", "The student can read the number but not tell what each place means.", "The student may read the number without understanding what each place represents."),
          makeOption("materials_only", "The student was stronger with materials than with written symbols.", "The student may show stronger understanding with concrete materials than with symbols."),
          makeOption("not_clear", "The exact cause is still not fully clear.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("ones", "Counting single ones only."),
          makeOption("tens", "Grouping in tens with support."),
          makeOption("read_number", "Reading the number was easier than partitioning it."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to cause the most trouble?", "language_comprehension", [
          makeOption("secure", "Words like ones, tens, hundreds seemed secure."),
          makeOption("digit_number", "Digit / number was mixed up.", "The student may be mixing up digit names with the value of the whole number."),
          makeOption("tens_hundreds", "Tens / hundreds language caused confusion.", "The student may need explicit teaching of tens and hundreds language."),
          makeOption("task_words", "The wording itself was the main issue.", "The task wording may be obscuring the place-value idea.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("bundles", "Use bundled sticks or MAB with a place-value mat."),
          makeOption("build_numbers", "Build and say numbers aloud before recording them."),
          makeOption("partition", "Practise partitioning numbers into tens and ones."),
          makeOption("step_back", "Step back to smaller quantities first.")
        ])
      ],
      sec_05a: [
        makePrompt("What most likely caused the breakdown in facts to 10?", "likely_barrier", [
          makeOption("not_known", "The facts are not yet known securely.", "The student does not yet have these facts secure."),
          makeOption("counting_all", "The student is still counting all rather than recalling or counting on.", "The student may still rely on counting-all strategies for facts to 10."),
          makeOption("inverse", "The subtraction link to the addition fact is not secure.", "The connection between addition and subtraction facts may not yet be secure."),
          makeOption("attention", "The student knew some facts but responses were inconsistent.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("addition", "Addition facts were stronger than subtraction."),
          makeOption("subitised", "Visual / dot patterns were stronger than symbols."),
          makeOption("count_on", "Counting on worked better than instant recall."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Add, take away, plus, minus seemed secure."),
          makeOption("minus_takeaway", "Minus / take away language caused confusion.", "The student may need clearer links between subtraction language and action."),
          makeOption("altogether", "Words like altogether / left caused confusion.", "The student may need explicit teaching of the problem-solving language used in fact questions."),
          makeOption("task_words", "The wording load caused more trouble than the numbers.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("materials", "Use counters/ten-frames and say the facts aloud."),
          makeOption("families", "Teach fact families and inverse pairs."),
          makeOption("count_on", "Strengthen counting-on from the larger number."),
          makeOption("daily_practice", "Use short daily recall practice in a smaller set.")
        ])
      ],
      sec_05b: [
        makePrompt("What most likely caused the breakdown in facts to 20?", "likely_barrier", [
          makeOption("bridging", "Bridging through 10 is not secure yet.", "The student may not yet use bridging-through-10 strategies reliably."),
          makeOption("recall", "The facts are not yet recalled quickly enough.", "The student does not yet recall these facts securely."),
          makeOption("inverse", "The subtraction facts are much weaker than the addition facts.", "The student may not yet connect subtraction facts to related addition facts."),
          makeOption("attention", "Inconsistency or stamina looked as important as the maths.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("within10", "Facts within 10 were stronger."),
          makeOption("addition", "Addition was stronger than subtraction."),
          makeOption("teen_numbers", "Teen-number structure was the issue."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to cause trouble?", "language_comprehension", [
          makeOption("secure", "Plus, minus, make, left were secure."),
          makeOption("make_ten", "Make / make ten language caused confusion.", "The student may need explicit language support around making and bridging ten."),
          makeOption("difference", "Difference / how many more language caused confusion.", "The student may need explicit support with comparison language."),
          makeOption("task_words", "The wording load itself seemed to block responses.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("ten_frames", "Use ten-frames and bridging-through-10 tasks."),
          makeOption("fact_families", "Link related addition and subtraction facts."),
          makeOption("teen_partition", "Partition teen numbers into ten and ones."),
          makeOption("daily_practice", "Use a smaller daily fact set before extending.")
        ])
      ],
      sec_06: [
        makePrompt("What most likely caused the difficulty in add/sub operations?", "likely_barrier", [
          makeOption("action_meaning", "The join/separate action in the story was not secure.", "The student may not yet connect the story action to the operation needed."),
          makeOption("strategy", "The student chose an inefficient or unreliable strategy.", "The student may need more reliable counting or modelling strategies."),
          makeOption("recording", "The student could show it with materials more than with symbols.", "The student may understand the action better than the written recording."),
          makeOption("not_clear", "The exact source of difficulty is still unclear.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("join", "Joining amounts was stronger than separating."),
          makeOption("materials", "Acting it out with materials was stronger than written work."),
          makeOption("small_numbers", "Smaller number stories were stronger."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to cause trouble?", "language_comprehension", [
          makeOption("secure", "Add, subtract, more, left seemed secure."),
          makeOption("more_less", "More / less / left language caused confusion.", "The student may need explicit support with comparison and removal language."),
          makeOption("story_words", "The story wording caused more trouble than the calculation.", "The wording of the context may be masking the maths thinking."),
          makeOption("difference", "Difference / how many more language caused confusion.", "The student may need clearer teaching of comparison problem language.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("act_it_out", "Act out join and separate stories with materials."),
          makeOption("drawings", "Draw the story before writing the number sentence."),
          makeOption("number_line", "Use a number line for counting on/back."),
          makeOption("step_back", "Step back to smaller story problems first.")
        ])
      ],
      sec_07a: [
        makePrompt("What most likely caused the difficulty in multiplication/division facts?", "likely_barrier", [
          makeOption("skip_count", "Skip counting is not secure enough yet.", "The student may not yet have a stable skip-counting base for these facts."),
          makeOption("equal_groups", "Equal groups or sharing is not secure yet.", "The student may not yet understand multiplication/division as equal groups."),
          makeOption("inverse", "The link between multiplication and division facts is weak.", "The inverse relationship between multiplication and division may not be secure."),
          makeOption("attention", "Responses looked inconsistent rather than fully concept-based.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("counting_groups", "Counting groups with materials."),
          makeOption("skip_count", "Skip counting aloud."),
          makeOption("multiply_only", "Multiplication facts were stronger than division."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to cause the most trouble?", "language_comprehension", [
          makeOption("secure", "Times, groups of, shared into seemed secure."),
          makeOption("groups_share", "Groups of / shared into caused confusion.", "The student may need explicit teaching of grouping and sharing language."),
          makeOption("division_words", "Division wording was the main issue.", "The wording for division situations may be getting in the way of the maths."),
          makeOption("task_words", "The overall wording load was too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("arrays", "Use arrays and equal-group materials."),
          makeOption("skip_count", "Strengthen skip counting with rhythm and movement."),
          makeOption("fact_families", "Teach multiplication/division fact families together."),
          makeOption("step_back", "Step back to smaller equal-group numbers first.")
        ])
      ],
      sec_08: [
        makePrompt("What most likely caused the difficulty with fractions of sets?", "likely_barrier", [
          makeOption("equal_parts", "Equal parts are not secure yet.", "The student may not yet understand that fractional parts must be equal."),
          makeOption("unit_fraction", "The meaning of one-half / one-quarter is not secure.", "The student may not yet connect fraction names to the amount each part represents."),
          makeOption("sharing", "Fair sharing with sets was the main barrier.", "The student may need stronger fair-sharing experiences before symbolic fraction tasks."),
          makeOption("language", "The wording looked harder than the fraction idea.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("halves", "Halves were stronger than quarters."),
          makeOption("shapes", "Shaded shapes were easier than sets."),
          makeOption("materials", "Sharing objects was easier than writing the answer."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to cause trouble?", "language_comprehension", [
          makeOption("secure", "Half, quarter, whole, equal parts were secure."),
          makeOption("equal_parts", "Equal parts language caused confusion.", "The student may need explicit teaching of equal parts language."),
          makeOption("fraction_names", "Fraction names such as half / quarter caused confusion.", "The student may need explicit support with fraction vocabulary."),
          makeOption("task_words", "The wording of the task caused more trouble than the maths.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("fair_share", "Use fair-sharing tasks with real objects."),
          makeOption("folding", "Fold shapes into equal parts and name them."),
          makeOption("fraction_sets", "Find halves and quarters of small sets."),
          makeOption("step_back", "Step back to unit fractions in concrete contexts first.")
        ])
      ]
    },
    phase2: {
      sec_01: [
        makePrompt("What most likely caused the place-value errors?", "likely_barrier", [
          makeOption("direction", "The student may be confusing 1/10/100 less with counting on.", "The student may be mixing up direction words such as less, before, and after."),
          makeOption("structure", "The student does not yet see the number as hundreds, tens, and ones.", "The student may not yet see the whole number as structured hundreds, tens, and ones."),
          makeOption("cross_zero", "Crossing through zero in a place-value column caused the issue.", "The student may not yet handle regrouping across zero in place-value changes."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What happened on partitioning and 'how many tens' type items?", "concept_detail", [
          makeOption("digit_only", "The student recognised the tens digit but not the total number of tens.", "The student may recognise digit positions but not total groups of ten within a number."),
          makeOption("materials_help", "The student could do it with materials or a chart but not with symbols.", "The student may understand the idea better with a place-value chart than in symbolic form."),
          makeOption("partitioning", "Expanded form / partitioning itself was not secure.", "The student may not yet partition numbers flexibly into hundreds, tens, and ones."),
          makeOption("not_checked", "This was not clear from the short check.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Less than, more than, before, after, tens, hundreds were secure."),
          makeOption("direction_words", "Less than / before / after caused confusion.", "The student may need explicit teaching of comparison and direction language."),
          makeOption("place_value_words", "Digit, number, tens, hundreds, expand caused confusion.", "The student may need explicit teaching of place-value vocabulary."),
          makeOption("how_many_tens", "'How many tens are in...' wording caused confusion.", "The student may be mixing up the tens digit with the number of tens in the whole number.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("place_value_chart", "Use a place-value chart with MAB or bundled sticks."),
          makeOption("before_after_oral", "Use short oral before/after prompts with materials."),
          makeOption("cross_zero", "Practise 1 less / 10 less / 100 less across zero with materials."),
          makeOption("step_back", "Step back to easier place-value tasks first.")
        ])
      ],
      sec_02: [
        makePrompt("What most likely caused the rounding errors?", "likely_barrier", [
          makeOption("nearest", "The student does not yet understand what 'nearest' means.", "The student may not yet connect rounding to the nearest benchmark value."),
          makeOption("midpoint", "The midpoint decision is the main issue.", "The student may not yet use the midpoint reliably when rounding."),
          makeOption("place_value", "The target place value for rounding is not secure.", "The student may not yet know which place value to attend to when rounding."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("whole_tens", "Rounding to the nearest 10 was stronger."),
          makeOption("whole_hundreds", "Rounding to the nearest 100 was stronger than decimals."),
          makeOption("with_number_line", "A number line helped more than mental rounding."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Round, nearest, between, midpoint seemed secure."),
          makeOption("nearest", "Nearest / between language caused confusion.", "The student may need explicit teaching of nearest and between language."),
          makeOption("place_value_words", "Tens / hundreds / tenths language caused confusion.", "The student may need explicit support with place-value words in rounding tasks."),
          makeOption("task_words", "The wording load itself seemed to block the response.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("number_line", "Use open number lines and benchmark numbers."),
          makeOption("sort_examples", "Sort numbers that round up or down and explain why."),
          makeOption("one_place", "Teach one rounding place at a time before mixing them."),
          makeOption("step_back", "Step back to whole-number rounding first.")
        ])
      ],
      sec_03: [
        makePrompt("What most likely caused the add/subtract errors?", "likely_barrier", [
          makeOption("operation_choice", "Choosing add or subtract in the question was the main issue.", "The student may not yet connect the wording of the task to the correct operation."),
          makeOption("place_value", "Place-value alignment / regrouping caused the issue.", "The student may need stronger place-value alignment in written methods."),
          makeOption("strategy", "The strategy chosen was inefficient or unreliable.", "The student may need a more reliable method for these calculations."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("mental", "Simple mental calculations were stronger."),
          makeOption("written", "Written method with support was stronger."),
          makeOption("addition", "Addition was stronger than subtraction."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Altogether, difference, more than, less than seemed secure."),
          makeOption("comparison", "Difference / more than / less than caused confusion.", "The student may need explicit teaching of comparison language in operation questions."),
          makeOption("story_words", "The story wording caused more trouble than the calculation.", "The context wording may be masking the operation choice."),
          makeOption("task_words", "The general wording load seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("model_method", "Model one reliable written or mental method."),
          makeOption("bar_models", "Use bar models or acted examples before equations."),
          makeOption("place_value_grid", "Use place-value grids for regrouping."),
          makeOption("step_back", "Step back to easier prerequisite calculations first.")
        ])
      ],
      sec_04: [
        makePrompt("What most likely caused the facts recall errors?", "likely_barrier", [
          makeOption("not_recalled", "The facts are not yet retrieved quickly enough.", "The student does not yet retrieve these facts securely."),
          makeOption("related_facts", "The student does not yet link related multiplication/division facts.", "The student may need stronger links between related facts."),
          makeOption("grouping", "Equal-group meaning is weaker than rote recall.", "The student may not yet connect the facts to equal-group meaning."),
          makeOption("attention", "Responses looked inconsistent rather than fully concept-based.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("multiply", "Multiplication facts were stronger than division."),
          makeOption("skip_count", "Skip counting was stronger than instant recall."),
          makeOption("array", "Arrays or groups helped more than symbols."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Times, groups of, divided by, share equally seemed secure."),
          makeOption("times_groups", "Times / groups of caused confusion.", "The student may need explicit teaching of multiplication language."),
          makeOption("division_words", "Divided by / shared equally caused confusion.", "The student may need explicit teaching of division language."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("arrays", "Use arrays and equal-group models."),
          makeOption("fact_families", "Teach related multiplication/division facts together."),
          makeOption("skip_count", "Strengthen skip counting first."),
          makeOption("daily_practice", "Use a smaller daily fact set before extending.")
        ])
      ],
      sec_05a: [
        makePrompt("What most likely caused the multiplication errors?", "likely_barrier", [
          makeOption("place_value", "Place-value structure in multi-digit multiplication was the main issue.", "The student may not yet hold place value securely within multiplication."),
          makeOption("groups", "The student understands repeated groups only in simpler cases.", "The student may need stronger links between equal groups and written multiplication."),
          makeOption("procedure", "The written procedure was not secure.", "The student may need a more secure written multiplication process."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("single_digit", "Single-digit multiplication was stronger."),
          makeOption("materials", "Arrays or groups were stronger than written symbols."),
          makeOption("partial_products", "Breaking the number apart helped."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Times, groups of, lots of, multiply by seemed secure."),
          makeOption("groups", "Groups of / lots of caused confusion.", "The student may need explicit teaching of multiplicative language."),
          makeOption("place_value_words", "Place-value words inside the method caused confusion.", "The student may need clearer place-value language during multiplication."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("arrays_area", "Use arrays or area models before the compact method."),
          makeOption("partition", "Partition numbers and multiply each part."),
          makeOption("written_steps", "Teach one written algorithm step by step."),
          makeOption("step_back", "Step back to easier multiplication structures first.")
        ])
      ],
      sec_05b: [
        makePrompt("What most likely caused the division errors?", "likely_barrier", [
          makeOption("equal_groups", "The equal-groups / sharing idea is not secure enough yet.", "The student may not yet understand division situations as equal groups or sharing."),
          makeOption("remainders", "Remainders caused the main issue.", "The student may not yet understand what a remainder means."),
          makeOption("place_value", "Place value inside the written division method caused the issue.", "The student may need stronger place-value support in written division."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("sharing", "Sharing equally was stronger than grouping."),
          makeOption("grouping", "Grouping was stronger than the written algorithm."),
          makeOption("no_remainder", "Questions without remainders were stronger."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Shared into, groups of, each, remainder seemed secure."),
          makeOption("share_groups", "Shared into / groups of caused confusion.", "The student may need explicit support with division situation language."),
          makeOption("remainder", "Remainder language caused confusion.", "The student may need explicit teaching of what a remainder means."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("materials", "Use counters or arrays to model equal groups."),
          makeOption("remainders", "Teach remainders with concrete grouping tasks."),
          makeOption("recording", "Link concrete grouping to the written recording."),
          makeOption("step_back", "Step back to simpler division structures first.")
        ])
      ],
      sec_06a: [
        makePrompt("What most likely caused the decimal comparison errors?", "likely_barrier", [
          makeOption("whole_number", "The student is treating decimals like whole numbers.", "The student may be comparing decimals as if the longest numeral is the largest."),
          makeOption("place_value", "Tenths and hundredths place value is not secure.", "The student may not yet understand the place value of decimal digits."),
          makeOption("number_line", "The student needs a magnitude model such as a number line.", "The student may need stronger sense of decimal size on a number line."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("tenths", "Tenths were stronger than hundredths."),
          makeOption("same_whole", "Numbers with the same whole-number part were easier."),
          makeOption("with_model", "A number line or place-value chart helped."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Tenths, hundredths, greater than, less than seemed secure."),
          makeOption("decimal_words", "Tenths / hundredths language caused confusion.", "The student may need explicit teaching of decimal place-value words."),
          makeOption("comparison_words", "Greater than / less than caused confusion.", "The student may need explicit teaching of comparison language with decimals."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("place_value_chart", "Use a decimal place-value chart."),
          makeOption("number_line", "Place decimals on a number line."),
          makeOption("compare_pairs", "Compare carefully chosen decimal pairs and explain why."),
          makeOption("step_back", "Step back to tenths only first.")
        ])
      ],
      sec_06b: [
        makePrompt("What most likely caused the conversion errors?", "likely_barrier", [
          makeOption("equivalence", "The student does not yet connect fractions, decimals, and percentages as equivalent forms.", "The student may not yet see fractions, decimals, and percentages as equivalent representations."),
          makeOption("percent_100", "Percent as 'out of 100' is not secure.", "The student may not yet understand percentage as out of 100."),
          makeOption("notation", "The notation change itself caused confusion.", "The student may understand one notation more than the others."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("fraction_decimal", "Fraction-decimal links were stronger than percentages."),
          makeOption("benchmark", "Benchmark equivalents such as 1/2 = 0.5 = 50% were stronger."),
          makeOption("visual", "Visual models were stronger than symbols."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Equivalent, percent, decimal, fraction seemed secure."),
          makeOption("equivalent", "Equivalent language caused confusion.", "The student may need explicit teaching of equivalent-as-same-value language."),
          makeOption("percent", "Percent / out of 100 language caused confusion.", "The student may need explicit teaching of percentage language."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("visual_models", "Use grids, strips, or hundred squares."),
          makeOption("benchmark", "Teach benchmark equivalents first."),
          makeOption("match_cards", "Match cards across fraction, decimal, and percent forms."),
          makeOption("step_back", "Step back to one representation pair first.")
        ])
      ],
      sec_07: [
        makePrompt("What most likely caused the x10 / x100 scaling errors?", "likely_barrier", [
          makeOption("digit_shift", "The student may be using an over-simplified 'move the digits' rule.", "The student may be relying on a digits-shift rule instead of place-value reasoning."),
          makeOption("place_value", "The student does not yet understand how each digit changes value.", "The student may not yet understand how digits change value when multiplying or dividing by powers of 10."),
          makeOption("decimal_point", "The decimal point is being interpreted inconsistently.", "The student may need clearer understanding of how the decimal point anchors place value."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("multiply10", "Multiplying by 10 was stronger than dividing."),
          makeOption("whole_numbers", "Whole numbers were stronger than decimals."),
          makeOption("with_chart", "A place-value chart helped more than mental rules."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Times 10, divide by 10, tenths, hundredths seemed secure."),
          makeOption("times_divide", "Times by / divide by language caused confusion.", "The student may need explicit support with multiplicative language."),
          makeOption("decimal_words", "Tenths / hundredths language caused confusion.", "The student may need explicit teaching of decimal place-value words."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("place_value_chart", "Use a place-value chart and track digit values."),
          makeOption("compare_pairs", "Compare original and scaled numbers side by side."),
          makeOption("whole_then_decimal", "Teach whole numbers first, then decimals."),
          makeOption("step_back", "Step back to one scaling factor at a time.")
        ])
      ],
      sec_08: [
        makePrompt("What most likely caused the decimal add/subtract errors?", "likely_barrier", [
          makeOption("alignment", "Decimal alignment was the main issue.", "The student may not yet align place values correctly in decimal calculations."),
          makeOption("place_value", "Tenths and hundredths values are not secure enough.", "The student may not yet understand the size of tenths and hundredths in calculation."),
          makeOption("operation_choice", "The operation or strategy choice was the issue.", "The student may need a more reliable decimal calculation strategy."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("tenths", "Tenths only were stronger than hundredths."),
          makeOption("addition", "Addition was stronger than subtraction."),
          makeOption("grid_help", "A place-value grid helped more than lined-up digits alone."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Decimal point, tenths, hundredths, add, subtract seemed secure."),
          makeOption("decimal_words", "Tenths / hundredths language caused confusion.", "The student may need explicit teaching of decimal place-value vocabulary."),
          makeOption("operation_words", "Add / subtract wording caused confusion.", "The student may need clearer support with the operation language used in decimal tasks."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("grid", "Use a place-value grid for decimal calculations."),
          makeOption("money_measure", "Use money or measurement contexts."),
          makeOption("rename", "Rename decimals with equivalent tenths/hundredths."),
          makeOption("step_back", "Step back to tenths only first.")
        ])
      ],
      sec_09: [
        makePrompt("What most likely caused the mixed/improper fraction errors?", "likely_barrier", [
          makeOption("whole_part", "The whole-and-part relationship is not secure enough yet.", "The student may not yet understand how many parts make one whole."),
          makeOption("equivalence", "Equivalent fractions needed for conversion are not secure.", "The student may not yet see the equivalence needed when converting mixed and improper fractions."),
          makeOption("notation", "The notation change itself caused confusion.", "The student may understand one form better than the other."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("mixed", "Reading mixed numbers was stronger than converting them."),
          makeOption("improper", "Improper fractions were easier when drawn."),
          makeOption("visual", "Fraction models helped more than symbols."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Numerator, denominator, mixed number, improper fraction seemed secure."),
          makeOption("fraction_terms", "Numerator / denominator caused confusion.", "The student may need explicit teaching of fraction-part vocabulary."),
          makeOption("mixed_improper", "Mixed number / improper fraction caused confusion.", "The student may need explicit teaching of the names of the two forms."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("fraction_strips", "Use fraction strips or circles to build wholes."),
          makeOption("build_wholes", "Build improper fractions into wholes and leftover parts."),
          makeOption("record_pairs", "Record the visual model and symbolic pair together."),
          makeOption("step_back", "Step back to unit and benchmark fractions first.")
        ])
      ],
      sec_10: [
        makePrompt("What most likely caused the fraction/percentage-of-number errors?", "likely_barrier", [
          makeOption("of_means", "The meaning of 'of' as an operator is not secure.", "The student may not yet understand 'of' as acting on the quantity."),
          makeOption("partition", "Partitioning the set or amount into equal parts was the issue.", "The student may not yet partition amounts reliably for fraction-of tasks."),
          makeOption("percent", "Percentage-of-a-number is weaker than simple fraction-of.", "The student may not yet connect percentages to fraction/decimal operators."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("fractions", "Simple fractions of sets were stronger than percentages."),
          makeOption("materials", "Using counters or diagrams was stronger than symbols."),
          makeOption("benchmark", "Benchmark percentages such as 50% were stronger."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Of, half, quarter, percent, shared equally seemed secure."),
          makeOption("of_word", "'Of' caused confusion.", "The student may need explicit teaching that 'of' means take that fraction or percent of the whole amount."),
          makeOption("percent_words", "Percent / percentage language caused confusion.", "The student may need explicit teaching of percentage language."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("bar_model", "Use bar models or set models to show the fraction of the whole."),
          makeOption("equal_parts", "Practise splitting amounts into equal parts."),
          makeOption("benchmark_percent", "Teach benchmark percentages before harder ones."),
          makeOption("step_back", "Step back to unit fractions of sets first.")
        ])
      ],
      sec_11: [
        makePrompt("What most likely caused the fraction comparison/simplifying errors?", "likely_barrier", [
          makeOption("size", "The student does not yet reason about fraction size well enough.", "The student may not yet compare fractions by size with confidence."),
          makeOption("equivalence", "Equivalent fractions are not secure enough yet.", "The student may not yet use equivalence reliably when comparing or simplifying fractions."),
          makeOption("common_denominator", "Finding or using common denominators was the issue.", "The student may not yet use common denominators effectively."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("same_denom", "Fractions with the same denominator were stronger."),
          makeOption("visual", "Fraction strips or drawings helped more than symbols."),
          makeOption("simplify_only", "Simplifying familiar fractions was stronger than ordering them."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Equivalent, simplest form, greater than, denominator seemed secure."),
          makeOption("equivalent", "Equivalent / simplest form language caused confusion.", "The student may need explicit teaching of equivalence and simplest-form language."),
          makeOption("comparison", "Greater than / less than language caused confusion.", "The student may need explicit teaching of comparison language in fraction tasks."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("fraction_strips", "Use fraction strips or a fraction wall."),
          makeOption("benchmark", "Compare fractions to one-half and one whole."),
          makeOption("equivalence", "Teach equivalence before simplify/order tasks."),
          makeOption("step_back", "Step back to same-denominator comparisons first.")
        ])
      ],
      sec_12: [
        makePrompt("What most likely caused the fraction add/subtract errors?", "likely_barrier", [
          makeOption("denominator", "The student does not yet understand what happens to the denominator.", "The student may not yet understand why the denominator stays the same or when equivalent fractions are needed."),
          makeOption("equivalence", "Equivalent fractions needed before calculating were not secure.", "The student may not yet use equivalent fractions reliably before adding or subtracting."),
          makeOption("whole_parts", "The student is combining the numbers procedurally without understanding the parts.", "The student may be applying a rule without understanding the fraction parts."),
          makeOption("not_clear", "The exact cause is still not clear enough.")
        ]),
        makePrompt("What looked strongest?", "secure_floor", [
          makeOption("same_denom", "Same-denominator questions were stronger."),
          makeOption("visual", "Visual models helped more than symbols."),
          makeOption("addition", "Addition was stronger than subtraction."),
          makeOption("not_secure", "No clear starting point yet.")
        ]),
        makePrompt("Which language seemed to block the response?", "language_comprehension", [
          makeOption("secure", "Numerator, denominator, equivalent, simplify seemed secure."),
          makeOption("fraction_terms", "Numerator / denominator language caused confusion.", "The student may need explicit teaching of fraction-part vocabulary."),
          makeOption("equivalent", "Equivalent fraction language caused confusion.", "The student may need explicit support with equivalent-fraction language."),
          makeOption("task_words", "The wording load itself seemed too high.")
        ]),
        makePrompt("What is the best next teaching move?", "teaching_entry", [
          makeOption("fraction_models", "Use fraction strips or diagrams to combine parts."),
          makeOption("same_denom", "Rebuild same-denominator calculations first."),
          makeOption("equivalent_first", "Teach equivalent fractions before mixed examples."),
          makeOption("step_back", "Step back to simpler fraction-part tasks first.")
        ])
      ]
    }
  };

  const prompts = promptSets[phaseKey]?.[section?.section_id] || generic;
  return injectSectionLanguageOptions(section, prompts);
}

function getProbeOptionLabel(item, choiceId) {
  if (!choiceId || !Array.isArray(item?.response_options)) {
    return "";
  }
  return item.response_options.find((option) => option.id === choiceId)?.label || "";
}

function injectSectionLanguageOptions(section, prompts) {
  const terms = getSectionLanguageTerms(section);
  if (!terms.length) {
    return prompts;
  }

  const secureTerms = terms.slice(0, 5).join(", ");
  const focusedTerms = terms.slice(0, 3).join(", ");
  const secondaryTerms = terms.slice(3, 6).join(", ") || focusedTerms;

  return prompts.map((prompt) => {
    if (prompt.evidence_code !== "language_comprehension") {
      return prompt;
    }

    return {
      ...prompt,
      response_options: [
        {
          id: "secure",
          label: `The key section words seemed secure: ${secureTerms}.`
        },
        {
          id: "specific_terms",
          label: `Words such as ${focusedTerms} caused confusion.`,
          misconception_hint: `The student may need explicit teaching of section language such as ${focusedTerms}.`
        },
        {
          id: "rewording_helped",
          label: `The student understood better once words such as ${secondaryTerms} were reworded.`,
          misconception_hint: `The student may understand more than they can show until the section language is unpacked and reworded.`
        },
        {
          id: "task_words",
          label: "The full wording of the question still seemed to block the response.",
          misconception_hint: "The wording load may be getting in the way of the maths thinking."
        }
      ]
    };
  });
}

function getSectionLanguageTerms(section) {
  if (!section?.section_id) {
    return [];
  }

  const promptText = state.bank.items
    .filter((item) => item.section_id === section.section_id)
    .map((item) => `${item.prompt} ${section.topic} ${section.title}`)
    .join(" ")
    .toLowerCase();

  const candidateTerms = [
    "less than",
    "more than",
    "before",
    "after",
    "expand",
    "digit",
    "number",
    "tens",
    "hundreds",
    "thousands",
    "round",
    "nearest",
    "whole number",
    "tenth",
    "hundredth",
    "decimal",
    "larger",
    "greater than",
    "equal",
    "add",
    "subtract",
    "difference",
    "altogether",
    "times",
    "multiply",
    "groups of",
    "divide",
    "divided by",
    "shared equally",
    "remainder",
    "fraction",
    "mixed number",
    "improper fraction",
    "numerator",
    "denominator",
    "equivalent",
    "simplify",
    "percentage",
    "percent",
    "of"
  ];

  return candidateTerms.filter((term) => promptText.includes(term)).slice(0, 6);
}

function buildTeacherProbeSummary(teacherProbe) {
  const prefixByEvidenceCode = {
    likely_barrier: "Likely barrier",
    concept_detail: "Pattern seen",
    secure_floor: "Strongest so far",
    best_representation: "Best support",
    language_comprehension: "Language",
    teaching_entry: "Next move"
  };

  const parts = (teacherProbe?.probe_items || [])
    .filter((item) => item.selected_label)
    .map((item) => `${prefixByEvidenceCode[item.evidence_code] || "Probe"}: ${item.selected_label}`);

  return parts.join(" ");
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
  const selectedOptions = (teacherProbe?.probe_items || [])
    .map((item) => item.response_options?.find((option) => option.id === item.selected_option))
    .filter(Boolean);

  const hintedOption = selectedOptions.find((option) => option.misconception_hint);
  if (hintedOption?.misconception_hint) {
    return hintedOption.misconception_hint;
  }
  return fallback;
}

function startTeacherProbeFlowOrFinalize() {
  const nextRun = findNextProbeRun();
  if (!nextRun) {
    state.session.current_probe_section_id = null;
    state.session.current_probe_item_index = -1;
    state.notice = "";
    finalizeSession();
    return;
  }

  state.session.current_probe_section_id = nextRun.section_id;
  state.session.current_probe_item_index = -1;
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

  if (state.ui.current_phase === "phase2" && observedYearLabel === getPrePhaseLabel()) {
    const hasY4Boundary = attempts.some(
      (attempt) => attempt.year_level === getPhaseMinYear() && attempt.mastery_band !== "Secure"
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
  const completedSectionCards = sectionReportRows
    .filter((row) => !!row.summary)
    .map((row) => buildTeacherSectionCard(row))
    .join("");

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

      <h2>Section Summary</h2>
      <div class="section-summary-grid section-summary-grid-teacher-report">
        ${completedSectionCards || `<article class="section-summary-card section-summary-card-pending"><h3>No completed sections yet</h3><p>No teacher-facing summary is available until at least one section has been completed.</p></article>`}
      </div>

      ${completedProbeRows.length
        ? `<h2>Diagnostic Appendix</h2>
            <p class="subtle">Use this section when you want the detailed record behind the summary above.</p>
            <div class="teacher-probe-list">
              ${completedProbeRows.map((row) => `
                <article class="teacher-probe-card">
                  <h3>${escapeHtml(sectionLabel(row.section))}</h3>
                  <p class="teacher-probe-prompt">${escapeHtml(row.run.teacher_probe.teacher_summary || "Probe completed. See saved item-level notes in the exported session file.")}</p>
                  <div class="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Prompt</th>
                          <th>Teacher Choice</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${row.run.teacher_probe.probe_items.map((item) => `
                          <tr>
                            <td>${escapeHtml(item.prompt)}</td>
                            <td>${escapeHtml(item.selected_label || "Not selected")}</td>
                          </tr>
                        `).join("")}
                      </tbody>
                    </table>
                  </div>
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
      observedYear = averageYear < getPhaseMinYear()
        ? getPrePhaseLabel()
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
    ? ((weightedScore / totalWeight) < getPhaseMinYear()
      ? getPrePhaseLabel()
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
  const phase = state.bank?.assessment?.learning_phase || getCurrentPhaseConfig().label;
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
  const phase = state.bank?.assessment?.learning_phase || getCurrentPhaseConfig().label;
  const sectionReportRows = buildSectionReportRows();
  const completedSections = sectionReportRows.filter((row) => !!row.summary).length;
  const sectionSummaryBlocks = sectionReportRows
    .filter((row) => !!row.summary)
    .map((row) => buildTeacherSectionPdfBlock(row))
    .join("");
  const probeBlocks = sectionReportRows
    .filter((row) => row.run?.teacher_probe?.status === "completed")
    .map((row) => `
      <h3>${escapeHtml(sectionLabel(row.section))} Probe</h3>
      <p>${escapeHtml(row.run.teacher_probe.teacher_summary || "Probe completed with item-level notes only.")}</p>
      <table>
        <thead>
          <tr>
            <th>Prompt</th>
            <th>Teacher Choice</th>
            <th>Evidence Focus</th>
          </tr>
        </thead>
        <tbody>
          ${row.run.teacher_probe.probe_items.map((item) => `
            <tr>
              <td>${escapeHtml(item.prompt)}</td>
              <td>${escapeHtml(item.selected_label || "Not selected")}</td>
              <td>${escapeHtml(item.evidence_code)}</td>
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
      <h3>Section Summary</h3>
      <div class="summary-grid">${sectionSummaryBlocks || "<p>No completed sections yet.</p>"}</div>
      ${probeBlocks ? `<h3>Diagnostic Appendix</h3><p class="pdf-note">Detailed teacher-check evidence is included below for reference.</p>${probeBlocks}` : ""}
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
      <p class="pdf-note"><strong>Confidence rating:</strong> High = student reached the observed level and also showed a non-secure result one level higher. Medium = usable evidence but without that upper boundary. Low = too few attempts or too many skips to be certain.</p>
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
          .summary-grid { display: grid; gap: 12px; margin: 10px 0 16px; }
          .summary-card { border: 1px solid #d8e1db; border-radius: 14px; padding: 12px; background: #fbfdfb; page-break-inside: avoid; }
          .summary-card h4 { margin: 0 0 8px; font-size: 1rem; }
          .summary-kv { margin: 6px 0 0; font-size: 0.92rem; }
          .summary-kv strong { color: #20313c; }
          .summary-paragraph { margin: 10px 0 0; font-size: 0.94rem; line-height: 1.45; }
          .pdf-note { font-size: 0.82rem; color: #6b7280; margin-top: 1rem; border-top: 1px solid #e5e7eb; padding-top: 0.8rem; }
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
    state.ui.current_phase === "phase2" && summary.observed_year_level === getPrePhaseLabel()
      ? `Re-teach prerequisite skills for ${topic} prior to Year 4.`
      : `Re-teach prerequisite skills for ${topic} below ${bestFitYear}.`,
    "Use worked examples and guided practice before reassessment."
  ];
}

function getTeacherProbeChoice(run, evidenceCode) {
  return run?.teacher_probe?.probe_items?.find((item) => item.evidence_code === evidenceCode)?.selected_label || "";
}

function simplifyLastSecureSkillText(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return "";
  }
  return raw
    .replace(/^Start just below\s+/i, "Start just below ")
    .replace(/\s+tasks in\s+/i, " work in ")
    .replace(/\s+were secure\.$/i, " was more secure.")
    .replace(/^Collect a few easier checks.*$/i, "A clearer starting point still needs to be checked.");
}

function buildTeacherSectionSummary(row) {
  const diagnosticSummary = row.run?.diagnostic_summary || buildDiagnosticSummary(row.section, row.summary);
  const bestFit = formatTeacherYearLabel(row.summary.observed_year_level);
  const language = getTeacherProbeChoice(row.run, "language_comprehension") || "No specific language issue was confirmed.";
  const nextMove = getTeacherProbeChoice(row.run, "teaching_entry") || getNextStepForSection(row.section, row.summary)[0] || "";
  const strongest = getTeacherProbeChoice(row.run, "secure_floor") || simplifyLastSecureSkillText(diagnosticSummary.last_secure_skill);
  const whatThisSuggests = diagnosticSummary.likely_misconception;
  const teacherCheck = row.run?.teacher_probe?.status === "completed" ? "Used" : "Not used";
  const narrative = `This student is working around ${bestFit} in ${sectionLabel(row.section)}. ${whatThisSuggests} ${language === "No specific language issue was confirmed." ? "" : `Language to watch: ${language}`} ${nextMove ? `Best next move: ${nextMove}` : ""}`.replace(/\s+/g, " ").trim();

  return {
    bestFit,
    confidence: row.summary.confidence,
    whatThisSuggests,
    strongest,
    language,
    nextMove,
    teacherCheck,
    narrative
  };
}

function buildTeacherSectionCard(row) {
  const summary = buildTeacherSectionSummary(row);
  return `
    <article class="section-summary-card teacher-report-card">
      <h3>${escapeHtml(sectionLabel(row.section))}</h3>
      <p><strong>Best-fit:</strong> ${escapeHtml(summary.bestFit)} <span class="teacher-report-divider">|</span> <strong>Confidence:</strong> ${escapeHtml(summary.confidence)} <span class="teacher-report-divider">|</span> <strong>Teacher check:</strong> ${escapeHtml(summary.teacherCheck)}</p>
      <p><strong>What this suggests:</strong> ${escapeHtml(summary.whatThisSuggests)}</p>
      <p><strong>Strongest so far:</strong> ${escapeHtml(summary.strongest)}</p>
      <p><strong>Language to watch:</strong> ${escapeHtml(summary.language)}</p>
      <p><strong>Best next teaching move:</strong> ${escapeHtml(summary.nextMove)}</p>
      <p class="teacher-report-narrative">${escapeHtml(summary.narrative)}</p>
    </article>
  `;
}

function buildTeacherSectionPdfBlock(row) {
  const summary = buildTeacherSectionSummary(row);
  return `
    <article class="summary-card">
      <h4>${escapeHtml(sectionLabel(row.section))}</h4>
      <p class="summary-kv"><strong>Best-fit:</strong> ${escapeHtml(summary.bestFit)} | <strong>Confidence:</strong> ${escapeHtml(summary.confidence)} | <strong>Teacher check:</strong> ${escapeHtml(summary.teacherCheck)}</p>
      <p class="summary-kv"><strong>What this suggests:</strong> ${escapeHtml(summary.whatThisSuggests)}</p>
      <p class="summary-kv"><strong>Strongest so far:</strong> ${escapeHtml(summary.strongest)}</p>
      <p class="summary-kv"><strong>Language to watch:</strong> ${escapeHtml(summary.language)}</p>
      <p class="summary-kv"><strong>Best next teaching move:</strong> ${escapeHtml(summary.nextMove)}</p>
      <p class="summary-paragraph">${escapeHtml(summary.narrative)}</p>
    </article>
  `;
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

function loadCurrentPhasePreference() {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) {
      return "phase2";
    }
    const parsed = JSON.parse(raw);
    return PHASE_CONFIGS[parsed.current_phase] ? parsed.current_phase : "phase2";
  } catch (_) {
    return "phase2";
  }
}

function saveSidebarPreference(collapsed) {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.sidebar_collapsed = !!collapsed;
    parsed.current_phase = state.ui.current_phase;
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(parsed));
  } catch (_) {}
}

function saveCurrentPhasePreference(phaseKey) {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.sidebar_collapsed = !!state.ui.sidebar_collapsed;
    parsed.current_phase = phaseKey;
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(parsed));
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
  if (state.session?.phase_key && state.session.phase_key !== state.ui.current_phase) {
    activatePhase(state.session.phase_key, { rerender: false });
  }
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
  if (state.ui.current_phase === "phase2" && value === getPrePhaseLabel()) {
    return `Below Y${getPhaseMinYear()}`;
  }

  if (typeof value === "number") {
    const year = Number(value);
    if (!Number.isFinite(year)) {
      return "";
    }
    if (state.ui.current_phase === "phase1") {
      return year === 0 ? "6 months" : `Y${year}`;
    }
    return year < getPhaseMinYear() ? `Y${year} question set` : `Y${year}`;
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
    const phaseEntryYear = formatTeacherYearLabel(getPhaseMinYear());
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
      headline: `Working below ${formatTeacherYearLabel(getPhaseMinYear())} in this section.`,
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
  if (String(value).trim().toLowerCase() === "6 months") {
    return 0;
  }
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
  if (state.ui.current_phase === "phase1") {
    return year === 0 ? "6 months" : `Y${year}`;
  }
  if (year < getPhaseMinYear()) {
    return getPrePhaseLabel();
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
