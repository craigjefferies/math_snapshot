# English Snapshot Project Spec

## 1. Purpose
Build an `English Snapshot` assessment system that follows the same broad product model as the existing maths snapshot:

- short online assessment
- teacher-selectable sections
- one-question-at-a-time student flow
- teacher-facing summary and PDF report
- stored sessions and device-local reopen flow
- section-level analysis plus an overall judgement

This is not intended to assess all of English. It is a reduced, practical snapshot designed to give teachers a defensible `Phase / Year level best-fit judgement` plus clear next teaching steps.

## 2. Curriculum Position
The English snapshot should align to the structure of the New Zealand Curriculum English Phase 1 and Phase 2 English pages, but only assess the parts that suit a short digital snapshot.

Reference sources:
- https://newzealandcurriculum.tahurangi.education.govt.nz/new-zealand-curriculum-online/nzc---english-phase-1-years-0-3/5637288579.p
- https://newzealandcurriculum.tahurangi.education.govt.nz/new-zealand-curriculum-online/nzc---english-phase-2-years-4-6/5637289329.p

Authoritative scope filter for snapshot design:
- [english-snapshot-curriculum-extraction.md](/home/craigjefferies/projects/maths_snapshots/docs/english-snapshot-curriculum-extraction.md)

The source material is organised around:
- oral language
- reading
- writing

This project will not make oral language a scored online section. It is too observational and too dependent on interaction, communication mode, and teacher judgement.

## 3. Core Product Decision
The English snapshot must produce both:

- an `overall Phase / Year level judgement`
- a `section and domain profile` that explains why

The overall judgement is important for teachers, but it must be derived from the profile rather than hiding uneven performance.

## 4. Scope
### In scope
- Phase 1 English snapshot for version 1
- Years 0-3 only
- three assessed domains:
  - Word Reading
  - Reading Meaning
  - Writing
- section-level best-fit judgements
- domain-level roll-up
- overall Phase / Year level judgement
- teacher probe
- teacher report and PDF
- messy-answer handling and inference rules

### Out of scope for version 1
- all of English
- oral language as a scored online strand
- extended writing composition scoring
- literature study
- media / visual language
- automated NLP judgement of broad writing quality
- a single opaque score with no section profile

### Planned extension after version 1
- Phase 2 English snapshot for Years 4-6
- using the reduced curriculum scope defined in [english-snapshot-curriculum-extraction.md](/home/craigjefferies/projects/maths_snapshots/docs/english-snapshot-curriculum-extraction.md)

## 5. Product Principles
- Reuse the maths snapshot shell where it already works.
- Do not force English into maths-style exact matching.
- Prefer deterministic scoring and teacher-supported review over fragile AI marking.
- Keep the assessment short and section-selectable.
- Preserve teacher readability in the report.
- English should be reported as a profile with an overall judgement layered on top.

## 6. High-Level Assessment Model
There will be three domains.

### 6.1 Word Reading
Purpose:
- identify current control of foundational reading skills

Suggested sections:
- Letter-sound knowledge / basic phonics
- Decoding and word recognition
- High-frequency words
- Simple spelling pattern transfer

Assessment style:
- mostly auto-scored
- short, precise items
- low tolerance for loose matching when the target skill is exact word reading

### 6.2 Reading Meaning
Purpose:
- identify how well the student gets meaning from words, sentences, and short texts

Suggested sections:
- Vocabulary in context
- Sentence meaning
- Literal comprehension
- Simple inference

Assessment style:
- mixed item types
- moderate tolerance for equivalent wording
- more meaning-based answer matching than word-reading sections

### 6.3 Writing
Purpose:
- identify whether the student can encode, construct, and communicate in written form

Suggested sections:
- Spelling / transcription
- Sentence construction
- Short written response

Assessment style:
- some auto-scored items
- some teacher-assisted review items
- short writing only in version 1

## 7. Section Architecture
Use the same broad structure as maths:

- teacher selects sections to run
- each section has year variants
- section result produces:
  - observed year / best-fit
  - confidence
  - evidence
  - likely barrier
  - next move

Proposed Phase 1 section list for version 1:
- `1. Word Reading Foundations`
- `2. Word Reading and High-Frequency Words`
- `3. Vocabulary and Sentence Meaning`
- `4. Short Text Reading Meaning`
- `5. Spelling and Encoding`
- `6. Sentence Writing`

Optional later addition:
- `7. Short Written Response`

## 8. Reuse From Maths Snapshot
The new English system should reuse the following patterns from the maths snapshot:

- left sidebar / phase structure
- setup flow
- session labels and saved sessions
- sections-to-run chooser
- assessment screen layout
- tracker and question navigation
- teacher probe flow
- teacher report shell
- PDF export flow
- JSON-driven bank design
- local session persistence

The maths snapshot should be treated as the implementation reference, not a strict schema lock.

## 9. What Must Change From Maths
- question bank content
- supported item types
- answer normalization logic
- answer resolution confidence model
- domain weighting and overall judgement logic
- report language
- teacher probe content

## 10. Item Types
Support these item types in version 1:

- multiple choice
- multi-select
- match / classify
- sequence ordering
- short text
- short phrase
- sentence input
- multi-field input
- teacher observation / teacher confirmation

Avoid in version 1:
- long free writing auto-scored by the system
- drag-heavy interactions
- long paragraph typing as a core scored task

## 11. Answer Resolution Model
This is the biggest English-specific requirement.

English answers will often be messy. The system must not rely only on exact string equality.

Each response should pass through a layered matcher:

1. exact match
2. normalized match
3. accepted-answer list
4. equivalent meaning match
5. close-match inference
6. teacher review if still ambiguous

Every resolved response should store:
- correctness
- resolution mode
- resolution confidence

Suggested resolution modes:
- `exact`
- `normalized`
- `accepted`
- `equivalent`
- `inferred`
- `teacher_confirmed`
- `unresolved`

Suggested confidence levels:
- `high`
- `medium`
- `low`

## 12. Normalization Rules
All text input should normalize:

- case
- leading/trailing spaces
- repeated spaces
- punctuation where punctuation is not the target
- straight/curly apostrophes
- common quote variants

Optional by item:
- ignore capitals
- ignore final punctuation
- ignore minor spacing

## 13. Messy Answer Handling by Domain
### Word Reading
Use stricter matching.

Allowed:
- case-insensitive match
- light punctuation cleanup
- explicit accepted alternatives

Not allowed by default:
- broad synonym matching
- loose spelling inference when the spelling itself is the skill being tested

### Reading Meaning
Use broader meaning tolerance.

Allowed:
- synonyms
- equivalent short phrases
- accepted paraphrases
- keyword-pattern rules

### Writing
Use the most cautious model.

Allowed:
- rule-based spelling tolerance where spelling is not the target
- pattern rules for sentence frames
- keyword coverage checks for short responses

Do not:
- pretend the system can reliably judge full writing quality on its own

For many writing items, version 1 should either:
- use teacher confirmation
- or use a deterministic rubric with a very small response scope

## 14. Suggested Matching Techniques
Use deterministic methods first:

- exact normalized string match
- token normalization
- acceptable synonym sets
- accepted phrase sets
- limited edit-distance threshold
- item-specific keyword rules
- item-specific order rules

Do not use open-ended LLM scoring for core correctness in version 1.

If AI is later used, it should only support:
- explanation drafting
- teacher-facing notes
- possible review suggestions

It must not silently replace deterministic scoring.

## 15. Teacher Review Path
Some English answers will be too ambiguous to auto-mark confidently.

When that happens:
- the system should mark the item as `needs review`
- preserve the student response
- allow the teacher to confirm correct / incorrect
- store that teacher confirmation in the session result

This is especially important in writing.

## 16. Scoring Model
Each section should still end in:
- `Secure`
- `Developing`
- `Not Yet`

Each section summary should include:
- observed year / best-fit
- confidence
- correct / total
- unresolved / teacher-confirmed counts if relevant

Confidence should be reduced when:
- too many answers needed review
- too many items were skipped
- matcher confidence was low
- evidence is uneven

## 17. Overall Judgement Model
The system must produce an overall `Phase / Year level judgement`.

Recommended calculation flow:

1. produce section judgements
2. roll sections into domain judgements
3. roll domains into overall judgement

Suggested domain weights for Phase 1 version 1:
- `Word Reading` = `0.40`
- `Reading Meaning` = `0.35`
- `Writing` = `0.25`

Guardrails:
- the overall judgement should not sit far above a weak Word Reading result
- if the spread across domains is more than one year, apply `uneven profile`
- if a domain confidence is low, reduce overall confidence

Suggested overall outputs:
- overall phase
- overall year-level best-fit
- confidence
- profile note such as `even profile` or `uneven profile`

## 18. Reporting Requirements
The teacher report must stay readable and non-duplicative.

Top of report:
- overall Phase / Year level judgement
- confidence
- sections completed
- profile note

Then per domain / section:
- best-fit
- confidence
- what this suggests
- strongest so far
- language/load to watch
- questions that caused difficulty
- best next teaching move

Diagnostic detail should sit below or in an appendix, not in the first summary block.

## 19. Teacher Probe
Reuse the current short teacher probe model.

Structure:
- 3 multiple-choice questions

Recommended evidence types:
- likely barrier
- strongest pattern seen
- language / wording issue

In English, probes should help separate:
- decoding weakness
- vocabulary weakness
- sentence comprehension weakness
- writing load
- task-language load
- inconsistent attention / stamina

## 20. Language and Access Flags
Since oral language is not a scored section, the system should still surface:

- task wording may have affected performance
- vocabulary load may have affected performance
- sentence complexity may have affected performance
- teacher follow-up recommended

These should appear as flags, not as an English score.

## 21. UI Requirements
Keep the existing maths snapshot UI pattern where possible.

Changes needed:
- English-specific question renderers
- writing-friendly input states
- teacher review state for ambiguous items
- English-specific report wording
- English-specific PDF content

Keep:
- one-question-at-a-time layout
- student-friendly large inputs
- teacher-side probe and reporting flow

## 22. Data Model Requirements
Add English-specific item fields such as:

- `english_domain`
- `skill_focus`
- `input_mode`
- `scoring_mode`
- `accepted_answers`
- `equivalent_answers`
- `synonyms`
- `spelling_tolerance`
- `ignore_case`
- `ignore_punctuation`
- `review_required`
- `teacher_review_allowed`

Session result should also capture:
- `resolution_mode`
- `resolution_confidence`
- `teacher_review_outcome`
- `language_load_flag`

## 23. Technical Delivery Plan
### Phase A: Core schema and bank model
- extend question-bank schema for English item metadata
- define English section / year structure
- create initial bank builder script

### Phase B: Answer engine
- build normalization pipeline
- build resolution modes
- build teacher review path

### Phase C: Assessment UI
- reuse maths shell
- add English item renderers
- add review states for ambiguous answers

### Phase D: Reporting
- section summaries
- domain summaries
- overall judgement
- PDF output

### Phase E: Probe and refinement
- English probe bank
- report wording polish
- acceptance testing with messy sample responses

## 24. MVP Recommendation
Build this order first:

1. `Word Reading Foundations`
2. `Word Reading and High-Frequency Words`
3. `Vocabulary and Sentence Meaning`
4. `Short Text Reading Meaning`
5. `Spelling and Encoding`
6. `Sentence Writing`

That is enough to produce a credible first overall judgement and a useful section profile.

After Phase 1 MVP is stable, extend into Phase 2 using the extracted Phase 2 snapshot domains and sections in [english-snapshot-curriculum-extraction.md](/home/craigjefferies/projects/maths_snapshots/docs/english-snapshot-curriculum-extraction.md).

## 25. Acceptance Criteria
The project is successful when:

- the app can run a short English snapshot using teacher-selected sections
- messy student input is handled more intelligently than exact match only
- ambiguous responses can be teacher-reviewed
- the system produces section-level best-fit judgements
- the system produces an overall Phase / Year level judgement
- the report is readable by teachers
- the PDF is usable as a teacher document
- the maths snapshot can clearly be seen as the implementation reference, but the English answer logic is meaningfully different

## 26. Build Constraint
The coding agent building the new system should:

- reuse the maths snapshot UI and app flow wherever sensible
- not copy the maths answer engine unchanged
- treat English scoring as a confidence-based resolution problem
- keep the system deterministic and teacher-defensible
- avoid over-automating judgement in writing
- use [english-snapshot-curriculum-extraction.md](/home/craigjefferies/projects/maths_snapshots/docs/english-snapshot-curriculum-extraction.md) as the curriculum scope filter before creating sections or question banks
