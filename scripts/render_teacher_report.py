#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a Maths Snapshots teacher report from exported session JSON."
    )
    parser.add_argument("input_json", type=Path, help="Path to exported session JSON")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("teacher-report.html"),
        help="Output path (.html always works; .pdf requires weasyprint)",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def esc(value: Any) -> str:
    return html.escape(str(value if value is not None else ""))


def diagnostic_summary(section: dict[str, Any]) -> dict[str, Any]:
    summary = section.get("diagnostic_summary") or {}
    flags = summary.get("confidence_risk_flags") or []
    return {
      "last_secure_skill": summary.get("last_secure_skill", "Not captured yet."),
      "likely_misconception": summary.get("likely_misconception", "Not captured yet."),
      "recommended_representation": summary.get("recommended_representation", "Teacher judgement required."),
      "teacher_probe_needed": summary.get("teacher_probe_needed", False),
      "teacher_probe_status": summary.get("teacher_probe_status", "not_needed"),
      "flags": flags,
      "rationale": summary.get("rationale", "No diagnostic rationale captured yet."),
    }


def build_overall_cards(payload: dict[str, Any]) -> str:
    overall = payload.get("overall_summary") or {}
    sections = payload.get("section_year_levels") or []
    completed = sum(1 for section in sections if section.get("observed_year_level"))
    return f"""
    <section class="hero">
      <article class="hero-card hero-card-primary">
        <span class="eyebrow">Overall NZC Best-Fit</span>
        <strong>{esc(overall.get("observed_operating_year", "Insufficient Data"))}</strong>
      </article>
      <article class="hero-card">
        <span class="eyebrow">Confidence</span>
        <strong>{esc(overall.get("confidence", "Low"))}</strong>
      </article>
      <article class="hero-card">
        <span class="eyebrow">Sections Completed</span>
        <strong>{completed}</strong>
      </article>
    </section>
    """


def build_sections_table(payload: dict[str, Any]) -> str:
    rows = []
    for section in payload.get("section_year_levels") or []:
        diag = diagnostic_summary(section)
        rows.append(
            f"""
            <tr>
              <td>{esc(section.get("section_title", section.get("section_id", "")))}</td>
              <td>{esc(section.get("observed_year_level", "—"))}</td>
              <td>{esc(section.get("confidence", "—"))}</td>
              <td>{esc(diag["last_secure_skill"])}</td>
              <td>{esc(diag["likely_misconception"])}</td>
              <td>{esc(diag["recommended_representation"])}</td>
            </tr>
            """
        )
    return f"""
    <section>
      <h2>Sections</h2>
      <table>
        <thead>
          <tr>
            <th>Section</th>
            <th>NZC Best-Fit</th>
            <th>Confidence</th>
            <th>Last Secure Skill</th>
            <th>Likely Misconception</th>
            <th>Recommended Representation</th>
          </tr>
        </thead>
        <tbody>{''.join(rows) or '<tr><td colspan="6">No section evidence captured.</td></tr>'}</tbody>
      </table>
    </section>
    """


def build_probe_summary(payload: dict[str, Any]) -> str:
    blocks = []
    for section in payload.get("section_year_levels") or []:
        diag = diagnostic_summary(section)
        probe = section.get("teacher_probe") or {}
        items = probe.get("probe_items") or []
        if not diag["teacher_probe_needed"] and not items:
            continue

        item_rows = "".join(
            f"""
            <tr>
              <td>{esc(item.get("prompt", ""))}</td>
              <td>{esc(item.get("selected_label", ""))}</td>
              <td>{esc(item.get("evidence_code", ""))}</td>
            </tr>
            """
            for item in items
        )
        flags = "".join(f"<li>{esc(flag)}</li>" for flag in diag["flags"])
        blocks.append(
            f"""
            <article class="probe-card">
              <h3>{esc(section.get("section_title", section.get("section_id", "")))}</h3>
              <p><strong>Probe status:</strong> {esc(probe.get("status", diag["teacher_probe_status"]))}</p>
              <p><strong>Rationale:</strong> {esc(diag["rationale"])}</p>
              <p><strong>Risk flags:</strong></p>
              <ul>{flags or '<li>No risk flags recorded.</li>'}</ul>
              <table>
                <thead>
                  <tr>
                    <th>Prompt</th>
                    <th>Teacher Choice</th>
                    <th>Evidence Code</th>
                  </tr>
                </thead>
                <tbody>{item_rows or '<tr><td colspan="3">No probe items recorded.</td></tr>'}</tbody>
              </table>
            </article>
            """
        )

    if not blocks:
        return ""

    return f"""
    <section>
      <h2>Diagnostic Probe</h2>
      <div class="stack">{''.join(blocks)}</div>
    </section>
    """


def build_strand_summary(payload: dict[str, Any]) -> str:
    rows = []
    for strand in payload.get("strand_summary") or []:
        rows.append(
            f"""
            <tr>
              <td>{esc(strand.get("strand_name", ""))}</td>
              <td>{esc(strand.get("observed_year_level", ""))}</td>
              <td>{esc(strand.get("confidence", ""))}</td>
              <td>{esc(', '.join(strand.get("supporting_sections") or []))}</td>
            </tr>
            """
        )
    return f"""
    <section>
      <h2>Strand Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Strand</th>
            <th>Observed Year</th>
            <th>Confidence</th>
            <th>Supporting Sections</th>
          </tr>
        </thead>
        <tbody>{''.join(rows) or '<tr><td colspan="4">No strand evidence captured.</td></tr>'}</tbody>
      </table>
    </section>
    """


def build_html(payload: dict[str, Any]) -> str:
    teacher = (payload.get("teacher") or {}).get("name", "")
    student = (payload.get("student") or {}).get("name", "")
    generated = payload.get("generated_at", "")

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Maths Snapshots Teacher Report</title>
  <style>
    body {{
      font-family: Arial, sans-serif;
      margin: 32px;
      color: #0f172a;
      line-height: 1.45;
    }}
    h1, h2, h3 {{ margin: 0 0 12px; }}
    section {{ margin-top: 24px; }}
    .meta {{
      display: grid;
      gap: 6px;
      margin-top: 12px;
      color: #475569;
    }}
    .hero {{
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-top: 20px;
    }}
    .hero-card {{
      padding: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      background: #fff;
    }}
    .hero-card-primary {{
      background: #eff6ff;
      border-color: #93c5fd;
    }}
    .eyebrow {{
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #475569;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      border: 1px solid #cbd5e1;
      padding: 10px;
      vertical-align: top;
      text-align: left;
    }}
    th {{
      background: #f8fafc;
    }}
    .stack {{
      display: grid;
      gap: 16px;
    }}
    .probe-card {{
      padding: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      background: #fff;
    }}
    @media print {{
      body {{ margin: 18px; }}
      .probe-card {{ break-inside: avoid; }}
    }}
  </style>
</head>
<body>
  <h1>Maths Snapshots Teacher Report</h1>
  <div class="meta">
    <div><strong>Teacher:</strong> {esc(teacher)}</div>
    <div><strong>Student:</strong> {esc(student)}</div>
    <div><strong>Generated:</strong> {esc(generated)}</div>
  </div>
  {build_overall_cards(payload)}
  {build_sections_table(payload)}
  {build_strand_summary(payload)}
  {build_probe_summary(payload)}
</body>
</html>
"""


def write_output(output_path: Path, html_content: str) -> None:
    if output_path.suffix.lower() == ".pdf":
        try:
            from weasyprint import HTML  # type: ignore
        except ImportError as exc:
            raise SystemExit(
                "PDF output requires weasyprint. Install it or write to .html instead."
            ) from exc
        HTML(string=html_content).write_pdf(str(output_path))
        return

    output_path.write_text(html_content, encoding="utf-8")


def main() -> None:
    args = parse_args()
    payload = load_json(args.input_json)
    html_content = build_html(payload)
    write_output(args.output, html_content)
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
