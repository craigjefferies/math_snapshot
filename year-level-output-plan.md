# Maths Snapshots SPA: Year-Level Output Plan

## Core goal
The app must output:
1. A year level for each section (math area).
2. Strand-level year indicators.
3. One overall observed operating year level.

This is formative evidence, not a standardised or summative judgement.

## Required outputs per student session
1. `section_year_levels[]`
- `section_id`
- `section_title`
- `strand`
- `target_year_variant` (if teacher forced a start year)
- `observed_year_level` (Y3-Y6)
- `score_percent`
- `mastery_band` (`Secure`, `Developing`, `Not Yet`)
- `confidence` (`High`, `Medium`, `Low`)

2. `strand_summary[]`
- `strand_name`
- `observed_year_level`
- `confidence`
- `supporting_sections`

3. `overall_summary`
- `observed_operating_year`
- `confidence`
- `method` (for example: weighted median of section years)

## Year determination model (section level)
Use adaptive section attempts across Y3-Y6 variants.

1. Start year
- Default start: teacher-selected year.
- Optional auto-start: previous overall year estimate.

2. Section rule
- `Secure`: score >= 80%.
- `Developing`: score 50-79%.
- `Not Yet`: score < 50%.

3. Section observed year algorithm
1. Find highest year with `Secure`.
2. If no `Secure`, use highest year with `Developing`.
3. If all `Not Yet`, assign below attempted year and mark `Low` confidence.
4. If `Secure` at Y6, assign Y6.

4. Confidence rule
- `High`: clear boundary (secure year and not secure at next year).
- `Medium`: developing boundary or sparse response.
- `Low`: high skip rate, inconsistent responses, or single-year evidence only.

## Overall operating year
1. Convert each section observed year to numeric value.
2. Apply strand balancing:
- Number Structure: 20%
- Number Operations: 40%
- Rational Numbers: 40%
3. Compute weighted median (preferred) or weighted mean (fallback).
4. Round to nearest year band and attach confidence.

## UI/report requirements
1. Results page must show a table: one row per section with observed year.
2. Show strand cards with year + confidence.
3. Show overall observed operating year at top.
4. Export JSON and CSV with all section-level year outputs included.
5. Print view must include:
- Per-section year,
- Strand year,
- Overall year,
- Short note: "Formative snapshot evidence only."

## Edge cases
1. Missing section attempt:
- Mark `Not Attempted`; exclude from overall calculation; lower confidence.
2. Timed facts section (Section 4):
- Treat skips as unanswered, not incorrect by default.
- If many timed skips, reduce confidence.
3. Teacher overrides:
- Allow override of section year with mandatory reason note.

## MVP implementation sequence
1. Implement section-level year output first.
2. Implement strand summaries second.
3. Implement overall observed year third.
4. Add confidence and override workflows fourth.
