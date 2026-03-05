# Maths Snapshots (Phase 2 SPA)

Client-side single-page web app for the **2025 Phase 2 Maths Snapshot**.

## What this app does
- Runs selected Phase 2 sections using phase-aligned year variants (Y4-Y6, plus Pre-Y4 checks that use the PDF's Y3 question set where available).
- Displays one question at a time to reduce cognitive load.
- Uses a consistent top header/nav with a `Home` action.
- During assessment, attempt/year details are shown in the top header (student/teacher names appear there once captured for report export).
- Shows a clickable numbered per-section tracker with connecting lines so students can jump back to unanswered questions.
- Dot tracker color states: green = correct, light grey = incorrect, pale = unanswered.
- Start options: `Start from Pre-Year 4 check (Y3 question set) and build upon` or `Start from specified year`.
- Sections start with none selected; use `Select All` or `Clear All`, while still allowing individual section selection.
- Input matcher accepts common equivalent formats (for example spacing/commas in expanded form, `remainder` vs `r`, `%` optional where applicable, and `equal/equivalent` for `=` prompts).
- `Expand this number` is rendered as 3 smart boxes and also accepts all parts typed into one box.
- Fraction answers use numerator/denominator boxes so students do not need to type `/`.
- Prompts display `÷` for division operations, while fractions keep `/`.
- After each section, a section summary screen appears with attempt history and a teacher-friendly section PDF.
- Final summary includes a teacher-friendly PDF with phase, final year level, correct, and next steps.
- Uses adaptive progression per section:
  - `Secure` result moves up a year (if available).
  - `Not Yet` result checks down a year (if available).
- Outputs:
  - observed year level for each section,
  - strand-level observed year,
  - overall observed operating year.
- Reports are exported via browser print-to-PDF workflow.
- Teacher and student names are prompted only when exporting teacher PDFs.

## Important note
This output is formative snapshot evidence only, not standardised or norm referenced.

## Run locally
```bash
cd /home/craigjefferies/projects/maths_snapshots
python3 -m http.server 4173
```
Open `http://localhost:4173`.

## Data and schemas
- Question bank schema: `schemas/question-bank.schema.json`
- Session result schema: `schemas/session-result.schema.json`
- Question bank data: `data/phase2-question-bank.json`
- Rebuild script for full PDF bank: `scripts/build_question_bank.py`

## Rebuild full question bank
```bash
python3 /home/craigjefferies/projects/maths_snapshots/scripts/build_question_bank.py
```

## Validate question-bank data
```bash
python3 - <<'PY'
import json
from pathlib import Path
from jsonschema import Draft202012Validator

base = Path('/home/craigjefferies/projects/maths_snapshots')
schema = json.loads((base/'schemas/question-bank.schema.json').read_text())
data = json.loads((base/'data/phase2-question-bank.json').read_text())
errors = list(Draft202012Validator(schema).iter_errors(data))
print('valid' if not errors else f'invalid: {len(errors)} error(s)')
PY
```
