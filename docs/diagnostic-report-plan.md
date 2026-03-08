# Diagnostic Reporting Plan

## Position
The current app is strong enough to place a student at a best-fit NZC level.

It is not yet strong enough to produce a high-confidence teaching strategy, because it captures where the student broke more reliably than why they broke.

## Recommendation
Do not add a second full assessment.

Add a short conditional teacher probe instead:
- Trigger only when section confidence is `Low` or `Medium`, or when risk flags indicate ambiguous evidence.
- Keep it to 2-4 prompts or 2-4 minutes.
- Capture teacher-observed evidence, not more student test fatigue.

## Evidence Gap
The report currently needs better evidence in six areas:
1. Error pattern: misconception vs slip vs guessing.
2. Last secure floor: the last concept the student can do reliably.
3. Representation check: symbolic vs materials vs place-value chart.
4. Language comprehension: whether the wording is the barrier.
5. Skip behaviour: knowledge gap vs overload vs shutdown.
6. Short live diagnostic interview: enough to resolve ambiguity.

## Proposed Data Additions
Add these fields to section-level output:
- `diagnostic_summary.last_secure_skill`
- `diagnostic_summary.likely_misconception`
- `diagnostic_summary.recommended_representation`
- `diagnostic_summary.teacher_probe_needed`
- `diagnostic_summary.teacher_probe_status`
- `diagnostic_summary.confidence_risk_flags[]`
- `diagnostic_summary.rationale`

Add these fields to each item result:
- `response_mode`: `answered`, `skipped`, `timed_out`, `corrected`, `guessed`

Add an optional teacher probe block:
- `teacher_probe.status`
- `teacher_probe.probe_items[]`
- `teacher_probe.teacher_summary`

## Suggested Probe Triggers
Run the short probe when any of these are true:
- section confidence is `Low`
- skip rate is above 30%
- student shows contradictory responses in the same construct
- a boundary item is failed but adjacent easier skills are unclear
- language-load risk is suspected

## Suggested Probe Structure
For a place-value section, use prompts like:
- Show me 409 with materials.
- What is 1 less than 409? How do you know?
- What is 10 less than 409? Show me.
- Expand 759.
- How many tens are in 759?

Each prompt should capture:
- prompt id
- teacher prompt
- response mode
- evidence code
- short teacher note

## Python Reporting Architecture
Keep the SPA as the assessment engine.

Add a Python report stage:
1. SPA exports `session-result` JSON.
2. Python script loads JSON.
3. Python derives summary flags and section strategy blocks.
4. Python renders HTML or PDF.

Benefits:
- deterministic pagination
- cleaner print layout than browser print
- richer rule-based strategy generation
- easier future templating

## What Must Change In The App
The SPA needs to export the extra evidence, but it does not need to generate the final strategy text itself.

Minimum app changes:
- store `response_mode` for each item
- add a short teacher probe UI
- export `diagnostic_summary`
- export `teacher_probe`

## Delivery Strategy
Phase 1:
- add export schema fields
- add Python report renderer
- keep current UI flow

Phase 2:
- add conditional teacher probe in the SPA
- generate stronger strategy text from probe data

## Decision
If the goal is better teacher action, the next investment should be:
- better evidence capture
- better report generation

Not:
- a longer student assessment
