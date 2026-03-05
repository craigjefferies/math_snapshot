I want to create an online web app (client side only) that a teacher can use to test students based on the 2025 Phase 2 Math Snapshot I've uploaded. 
We need to plan this in stages. 
NOTE: I will develop this in VS Code and using Codex 5.3 ... not this web app
I need to take the PDF questions and answers and sections and Year determination. 
Look over the PDF and help me decompose the problem
Thought for 11s

Here’s the clean decomposition.

The PDF is not one single test. It is a bank of 12 section-based mini checks across number and rational number content, intended to be used topic by topic, not all at once. It explicitly says teachers should “dip into” sections as needed rather than run the whole thing in one sitting. 

2025 Phase 2 Maths Snapshot Ans…

1) What the app actually is

At core, your app is:

a client-side assessment runner

backed by a structured question bank

with teacher-controlled section selection

plus simple scoring / evidence capture

and a year-level interpretation layer

This means the real job is not “build a web app first.”
It is:

extract the assessment into structured data

define scoring rules

define how year/phase judgements are inferred

then build the UI around that

2) What must be extracted from the PDF

From the uploaded PDF, you need to convert each section into machine-readable objects:

A. Assessment metadata

Global info from page 1:

assessment name

phase = Phase 2

intended range = Y4–6 in the title, but sections include Y3/Y4/Y5/Y6 pathways

teacher note: low-stakes, formative, not standardised, not norm referenced

teacher note: should not be completed all at once

section list 1–12 with topic names 

2025 Phase 2 Maths Snapshot Ans…

B. Section definitions

Each section needs:

section id

section title

sub-strand

topic

supported year bands

instructions

question items

answer key

scoring rule

display type

Example:

Section 1 = Place Value

Section 4 = Recall Multiplication and Division Facts

Section 6 has 6a and 6b

Section 5 has 5a and 5b 

2025 Phase 2 Maths Snapshot Ans…

C. Year-specific variants

This PDF is heavily year-banded. Many sections are not one question set, but parallel versions by year.

Example:

Section 1 has separate Y3, Y4, Y5, Y6 number sizes

Section 2 changes rounding complexity by year

Section 5 changes multiplication/division task complexity by year 

2025 Phase 2 Maths Snapshot Ans…

So your data model must support:

one section

many year variants

many items within each variant

D. Answers

This file appears to be an answer sheet / completed key (answers are shown in blue on the pages). That is useful, but it means you must separate:

prompt text

expected answer

optional alternate accepted forms

Example:

79 ÷ 3 = 26 r1 or decimal equivalent is shown in section 5b

several fraction items allow equivalent answers like 4/4 or 1 

2025 Phase 2 Maths Snapshot Ans…

 

2025 Phase 2 Maths Snapshot Ans…

3) Content types in the question bank

The app is not dealing with one uniform “question” type.
You have at least these types:

Single numeric response
Example: 37 + 18 = ? 

2025 Phase 2 Maths Snapshot Ans…

Missing number / fill-in-the-box
Example: 5 x [ ] = 40 

2025 Phase 2 Maths Snapshot Ans…

Choose larger of two values
Example: decimals and fractions comparisons 

2025 Phase 2 Maths Snapshot Ans…

 

2025 Phase 2 Maths Snapshot Ans…

Equivalent judgement
Example: “if both are equivalent put = between them” in section 11 

2025 Phase 2 Maths Snapshot Ans…

Conversion table entry
Example: fraction ↔ decimal ↔ percentage in section 6b 

2025 Phase 2 Maths Snapshot Ans…

Multi-part generated response
Example: section 1 asks for 1 more, 1 less, 10 more, 10 less, 100 more, 100 less, expanded form, tens count, hundreds count 

2025 Phase 2 Maths Snapshot Ans…

Timed recall items
Section 4 is special: it says multiplication/division fact recall should use an additional slideshow, each item shown for 4 seconds. That means your app either needs:

a built-in timer mode, or

you treat section 4 as a separate future module. 

2025 Phase 2 Maths Snapshot Ans…

That variation is the first major design constraint.

4) The scoring problem

You need to decide what “result” means.

There are three reasonable layers:

Layer 1: Item correctness

Per item:

correct

incorrect

skipped

partially correct (optional)

Layer 2: Section result

Per section:

raw score (7/9)

percentage

teacher judgement (secure, developing, not yet)

Layer 3: Year determination

This is the hard part.

The PDF provides year-banded task difficulty, but it does not explicitly state a formal “if student gets X then assign Year 5.” It gives aligned examples by Y3/Y4/Y5/Y6, but not a standardised cut-score system. 

2025 Phase 2 Maths Snapshot Ans…

So you need to choose one of these models:

Teacher-selected year pathway only
Teacher chooses Y4 section; app only tests Y4 items.
Lowest complexity. Safest.

Progressive year ladder
Start at one year, move up/down based on performance.
Better diagnostically.

Cross-year mastery profile
Store performance for each year-band within a section and infer “best-fit year” per strand.
Most useful, but more work.

For your first build, I would use teacher-selected pathway + simple mastery threshold, then add year inference later.

5) Data model you probably need

A good first-pass schema:

assessment

sections

sectionVariants (Y3/Y4/Y5/Y6)

items

acceptedAnswers

attempts

studentSessions

sectionResults

Minimal item fields:

id

sectionId

variantYear

prompt

answerType

correctAnswer

alternateAnswers[]

displayOrder

skillTag

isTimed

timeLimitSeconds

notes

For section 1, some rows are really a cluster around one anchor number, so you may also want:

groupId

anchorValue

That avoids messy UI logic later.

6) UX decomposition

Because this is teacher-facing, keep it simple.

Teacher workflow

Choose student

Choose section

Choose year pathway

Run section

Review answers

Save local result

Export / print summary

Student interaction

Since it is client-side only, likely:

teacher presents device

student enters answers

teacher can mark manually where needed

UI modes

You likely need two modes:

Assessment mode
clean, minimal, one item at a time or grouped table

Review mode
show correct answer, teacher override, notes

A big practical snag:
some sections are best shown as tables (e.g. section 1, 6b), while others are normal question cards. So your renderer should not be one-size-fits-all.

7) Special cases / snags in this PDF

These matter before coding.

A. Section 4 depends on an external slideshow

The teacher notes say multiplication/division fact recall should use an additional slideshow with 4-second display per item. That resource is not in this PDF. 

2025 Phase 2 Maths Snapshot Ans…

So:

either exclude section 4 from v1

or recreate it in-app as timed flash items

B. Some answers allow multiple forms

Examples:

remainder form or decimal

improper fraction or mixed number equivalents

simplified fraction vs equivalent fraction in some contexts 

2025 Phase 2 Maths Snapshot Ans…

 

2025 Phase 2 Maths Snapshot Ans…

Your answer checker must support:

numeric equivalence

fraction equivalence

multiple accepted strings

C. Pages 10–11 appear to have a header typo

Those pages say “Learning Phase 1 (Y4-6)” while continuing sections 9–12 of this same Phase 2 set. Content-wise, they clearly continue the sequence. Treat that as a source formatting issue, not a separate assessment. 

2025 Phase 2 Maths Snapshot Ans…

D. It is not standardised

The PDF explicitly says this is formative, low-stakes, and not for summative standardised judgement. 

2025 Phase 2 Maths Snapshot Ans…

So your app should avoid pretending it produces a formal “official maths age.”
Better wording:

“section mastery”

“observed readiness”

“next teaching steps”

8) Recommended staged build
Stage 1: Content extraction

Turn the whole PDF into JSON.

Deliverable:

one structured file for all sections, variants, and answers

Stage 2: Scoring rules

Define:

accepted answers

equivalent forms

section mastery thresholds

skipped handling

Stage 3: Prototype runner

Build a very plain UI:

choose section

choose year

answer questions

show result

Stage 4: Persistence

Since client-side only:

localStorage / IndexedDB

export JSON / CSV

Stage 5: Teacher reporting

Per session:

section attempted

year pathway

score

item breakdown

suggested next step

Stage 6: Better diagnostics

Add:

progressive year movement

strand profile across sections

simple “best-fit” year indicators

9) Best first technical cut

For v1, do not start with all 12 sections.

Start with:

Section 3: Add and Subtract Whole Numbers

Section 8: Add and Subtract Decimals

Section 10: Find a fraction of a number

Why:

clean input/output

fewer weird display rules

easy scoring

enough variation to prove the architecture 

2025 Phase 2 Maths Snapshot Ans…

 

2025 Phase 2 Maths Snapshot Ans…

 

2025 Phase 2 Maths Snapshot Ans…

Then add:

Section 1 (table-heavy)

Section 6b (conversion table)

Section 11/12 (fraction equivalence)

Section 4 last (timed mode)

10) The core decomposition in one sentence

This is really a structured assessment-content extraction problem first, a scoring-rules problem second, and only then a UI problem.

If you want, next I can turn this into:

a JSON schema for the question bank, or

a build roadmap for Codex 5.3 in VS Code.

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.org/schemas/nz-phase2-maths-snapshot-question-bank.schema.json",
  "title": "NZ Phase 2 Maths Snapshot (2025) - Question Bank",
  "type": "object",
  "required": ["schema_version", "assessment", "sections", "items"],
  "additionalProperties": false,

  "properties": {
    "schema_version": {
      "type": "string",
      "description": "Version of this question-bank schema (not the assessment).",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "examples": ["1.0.0"]
    },

    "assessment": {
      "type": "object",
      "required": [
        "assessment_id",
        "name",
        "publisher_year",
        "learning_phase",
        "intended_year_range",
        "notes"
      ],
      "additionalProperties": false,
      "properties": {
        "assessment_id": {
          "type": "string",
          "pattern": "^[a-z0-9_\\-]+$",
          "examples": ["nz_phase2_maths_snapshot_2025"]
        },
        "name": { "type": "string" },
        "publisher_year": { "type": "integer", "minimum": 2000, "maximum": 2100 },
        "learning_phase": {
          "type": "string",
          "enum": ["Phase 2"]
        },
        "intended_year_range": {
          "type": "object",
          "required": ["min", "max"],
          "additionalProperties": false,
          "properties": {
            "min": { "type": "integer", "minimum": 1, "maximum": 13 },
            "max": { "type": "integer", "minimum": 1, "maximum": 13 }
          }
        },
        "notes": {
          "type": "array",
          "items": { "type": "string" },
          "description": "General teacher-facing notes (e.g., formative, dip-in sections, etc.)."
        },
        "source": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "file_name": { "type": "string" },
            "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
          }
        }
      }
    },

    "sections": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/section" }
    },

    "items": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/item" }
    },

    "render_templates": {
      "type": "array",
      "description": "Optional: pre-defined UI renderers you support (cards, tables, timed flash, etc.).",
      "items": { "$ref": "#/$defs/renderTemplate" }
    },

    "tags": {
      "type": "array",
      "description": "Optional: global tag dictionary (skills/strands) to avoid repeated strings.",
      "items": { "$ref": "#/$defs/tag" }
    }
  },

  "$defs": {
    "section": {
      "type": "object",
      "required": [
        "section_id",
        "section_number",
        "title",
        "strand",
        "topic",
        "variants"
      ],
      "additionalProperties": false,
      "properties": {
        "section_id": {
          "type": "string",
          "pattern": "^sec_[0-9]{2}(_[a-z0-9]+)?$",
          "examples": ["sec_01", "sec_05a", "sec_06b"]
        },
        "section_number": {
          "type": "integer",
          "minimum": 1,
          "maximum": 50
        },
        "title": { "type": "string" },

        "strand": {
          "type": "string",
          "description": "High-level strand label used by your SMS/reporting. Keep stable.",
          "examples": ["Place Value", "Add/Sub Operations", "Rational Numbers"]
        },

        "topic": {
          "type": "string",
          "description": "More specific topic name for filtering (can match PDF headings)."
        },

        "instructions": {
          "type": "string",
          "description": "Teacher/student instructions for the section."
        },

        "time_mode": {
          "type": "string",
          "enum": ["untimed", "timed_flash", "timed_section"],
          "default": "untimed",
          "description": "Use timed_flash for 4-second fact recall style."
        },

        "default_time_limit_seconds": {
          "type": "integer",
          "minimum": 1,
          "description": "If time_mode implies a timer and you want a default."
        },

        "render_hint": {
          "type": "string",
          "description": "Optional pointer to a renderer: card, table, grid, conversion-table, etc.",
          "examples": ["card", "table", "conversion_table", "equivalence_judgement"]
        },

        "variants": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/variant" },
          "description": "Parallel versions by year (e.g., Y3/Y4/Y5/Y6) or other pathway."
        },

        "reporting": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "mastery_threshold": {
              "type": "object",
              "description": "Optional heuristic thresholds; not 'official'.",
              "additionalProperties": false,
              "properties": {
                "secure_pct": { "type": "number", "minimum": 0, "maximum": 100 },
                "developing_pct": { "type": "number", "minimum": 0, "maximum": 100 }
              }
            },
            "notes": { "type": "string" }
          }
        }
      }
    },

    "variant": {
      "type": "object",
      "required": ["variant_id", "year_level", "item_refs"],
      "additionalProperties": false,
      "properties": {
        "variant_id": {
          "type": "string",
          "pattern": "^var_[a-z0-9_\\-]+$",
          "examples": ["var_y3", "var_y4", "var_y5", "var_y6"]
        },
        "year_level": {
          "type": "integer",
          "minimum": 1,
          "maximum": 13
        },
        "year_label": {
          "type": "string",
          "description": "Optional display label (e.g., 'Year 4')."
        },
        "difficulty_order": {
          "type": "integer",
          "description": "Optional ordering if you later ladder up/down across variants."
        },
        "item_refs": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/itemRef" },
          "description": "References into the top-level items array by item_id, plus ordering/grouping info."
        }
      }
    },

    "itemRef": {
      "type": "object",
      "required": ["item_id"],
      "additionalProperties": false,
      "properties": {
        "item_id": {
          "type": "string",
          "pattern": "^itm_[a-z0-9_\\-]+$"
        },
        "order": { "type": "integer", "minimum": 1 },
        "group_id": {
          "type": "string",
          "description": "Used when several prompts share an anchor (e.g., section 1 around one number)."
        }
      }
    },

    "item": {
      "type": "object",
      "required": [
        "item_id",
        "prompt",
        "answer",
        "answer_type"
      ],
      "additionalProperties": false,
      "properties": {
        "item_id": {
          "type": "string",
          "pattern": "^itm_[a-z0-9_\\-]+$"
        },

        "prompt": { "$ref": "#/$defs/richText" },

        "answer_type": {
          "type": "string",
          "enum": [
            "numeric",
            "integer",
            "decimal",
            "fraction",
            "mixed_number",
            "short_text",
            "choice_single",
            "choice_pair_compare",
            "relation_equivalence",
            "table_entry",
            "multi_field"
          ],
          "description": "Controls validation + UI widget."
        },

        "fields": {
          "type": "array",
          "description": "Only for multi_field items (or table_entry). Defines sub-answers.",
          "items": { "$ref": "#/$defs/field" }
        },

        "choices": {
          "type": "array",
          "description": "Only for choice-based items. Each choice is rich text.",
          "items": { "$ref": "#/$defs/richText" }
        },

        "answer": {
          "description": "Canonical expected answer. For multi_field, use an object mapping field_id->value.",
          "oneOf": [
            { "type": "string" },
            { "type": "number" },
            { "type": "integer" },
            {
              "type": "object",
              "additionalProperties": {
                "oneOf": [{ "type": "string" }, { "type": "number" }, { "type": "integer" }]
              }
            }
          ]
        },

        "accepted_answers": {
          "type": "array",
          "description": "Optional alternates (e.g., remainder form OR decimal, equivalent fraction forms).",
          "items": { "$ref": "#/$defs/acceptedAnswer" }
        },

        "validation": {
          "$ref": "#/$defs/validation"
        },

        "scoring": {
          "$ref": "#/$defs/scoring"
        },

        "metadata": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "section_id": {
              "type": "string",
              "pattern": "^sec_[0-9]{2}(_[a-z0-9]+)?$"
            },
            "variant_id": {
              "type": "string",
              "pattern": "^var_[a-z0-9_\\-]+$"
            },
            "tags": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Strand/topic/skill tags for reporting."
            },
            "source": {
              "$ref": "#/$defs/sourceRef"
            },
            "render_hint": {
              "type": "string",
              "description": "Per-item renderer hint (overrides section render_hint)."
            },
            "time_limit_seconds": {
              "type": "integer",
              "minimum": 1,
              "description": "Optional per-item timer (for flash recall)."
            }
          }
        }
      },

      "allOf": [
        {
          "if": { "properties": { "answer_type": { "const": "multi_field" } } },
          "then": { "required": ["fields"], "properties": { "answer": { "type": "object" } } }
        },
        {
          "if": { "properties": { "answer_type": { "enum": ["choice_single"] } } },
          "then": { "required": ["choices"] }
        }
      ]
    },

    "field": {
      "type": "object",
      "required": ["field_id", "label", "answer_type"],
      "additionalProperties": false,
      "properties": {
        "field_id": {
          "type": "string",
          "pattern": "^fld_[a-z0-9_\\-]+$"
        },
        "label": { "type": "string" },
        "answer_type": {
          "type": "string",
          "enum": ["numeric", "integer", "decimal", "fraction", "short_text", "relation_symbol"]
        },
        "placeholder": { "type": "string" }
      }
    },

    "acceptedAnswer": {
      "type": "object",
      "required": ["value"],
      "additionalProperties": false,
      "properties": {
        "value": {
          "oneOf": [{ "type": "string" }, { "type": "number" }, { "type": "integer" }]
        },
        "kind": {
          "type": "string",
          "enum": ["literal", "equivalent_numeric", "equivalent_fraction", "regex"],
          "default": "literal"
        },
        "note": { "type": "string" }
      }
    },

    "validation": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "trim": { "type": "boolean", "default": true },
        "case_sensitive": { "type": "boolean", "default": false },

        "numeric_tolerance": {
          "type": "number",
          "minimum": 0,
          "description": "For decimals, accept |user - answer| <= tolerance."
        },

        "fraction_equivalence": {
          "type": "boolean",
          "default": false,
          "description": "If true, reduce fractions and compare equivalence."
        },

        "accept_whitespace_variants": {
          "type": "boolean",
          "default": true
        },

        "regex_pattern": {
          "type": "string",
          "description": "If answer_type uses regex matching."
        }
      }
    },

    "scoring": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "max_points": { "type": "number", "minimum": 0, "default": 1 },
        "partial_credit": { "type": "boolean", "default": false },
        "rubric": {
          "type": "array",
          "description": "Optional: rule-based partial scoring.",
          "items": { "$ref": "#/$defs/rubricRule" }
        }
      }
    },

    "rubricRule": {
      "type": "object",
      "required": ["points", "when"],
      "additionalProperties": false,
      "properties": {
        "points": { "type": "number" },
        "when": {
          "type": "string",
          "description": "Freeform rule expression you interpret in code (keep v1 simple)."
        },
        "note": { "type": "string" }
      }
    },

    "richText": {
      "type": "object",
      "required": ["text"],
      "additionalProperties": false,
      "properties": {
        "text": {
          "type": "string",
          "description": "Plain text version (always present)."
        },
        "latex": {
          "type": "string",
          "description": "Optional LaTeX for math formatting (render client-side if you support it)."
        },
        "image": {
          "type": "object",
          "description": "Optional: embedded image asset reference if needed later.",
          "additionalProperties": false,
          "properties": {
            "asset_id": { "type": "string" },
            "alt": { "type": "string" }
          }
        }
      }
    },

    "sourceRef": {
      "type": "object",
      "required": ["page"],
      "additionalProperties": false,
      "properties": {
        "page": {
          "type": "integer",
          "minimum": 1,
          "description": "1-based page number in the source PDF."
        },
        "bbox": {
          "type": "array",
          "description": "Optional: [x1,y1,x2,y2] for traceability if you do extraction tooling.",
          "minItems": 4,
          "maxItems": 4,
          "items": { "type": "number" }
        },
        "note": { "type": "string" }
      }
    },

    "renderTemplate": {
      "type": "object",
      "required": ["template_id", "name", "description"],
      "additionalProperties": false,
      "properties": {
        "template_id": {
          "type": "string",
          "pattern": "^tpl_[a-z0-9_\\-]+$"
        },
        "name": { "type": "string" },
        "description": { "type": "string" }
      }
    },

    "tag": {
      "type": "object",
      "required": ["tag_id", "label"],
      "additionalProperties": false,
      "properties": {
        "tag_id": { "type": "string", "pattern": "^tag_[a-z0-9_\\-]+$" },
        "label": { "type": "string" },
        "category": { "type": "string", "examples": ["strand", "topic", "skill"] }
      }
    }
  }
}

And here’s a tiny example question-bank fragment that matches the schema (so you can sanity-check your extractor + UI renderer):

{
  "schema_version": "1.0.0",
  "assessment": {
    "assessment_id": "nz_phase2_maths_snapshot_2025",
    "name": "2025 Phase 2 Maths Snapshot",
    "publisher_year": 2025,
    "learning_phase": "Phase 2",
    "intended_year_range": { "min": 4, "max": 6 },
    "notes": [
      "Formative snapshot; sections can be used independently.",
      "Not intended to be completed all at once."
    ],
    "source": { "file_name": "2025 Phase 2 Maths Snapshot Answers.pdf" }
  },
  "sections": [
    {
      "section_id": "sec_03",
      "section_number": 3,
      "title": "Add and Subtract Whole Numbers",
      "strand": "Add/Sub Operations",
      "topic": "Add & subtract (whole numbers)",
      "instructions": "Answer each question.",
      "time_mode": "untimed",
      "render_hint": "card",
      "variants": [
        {
          "variant_id": "var_y4",
          "year_level": 4,
          "year_label": "Year 4",
          "difficulty_order": 4,
          "item_refs": [
            { "item_id": "itm_sec03_y4_q01", "order": 1 },
            { "item_id": "itm_sec03_y4_q02", "order": 2 }
          ]
        }
      ],
      "reporting": {
        "mastery_threshold": { "secure_pct": 80, "developing_pct": 50 },
        "notes": "Heuristic thresholds only."
      }
    }
  ],
  "items": [
    {
      "item_id": "itm_sec03_y4_q01",
      "prompt": { "text": "37 + 18 = ?" },
      "answer_type": "integer",
      "answer": 55,
      "accepted_answers": [{ "value": "55", "kind": "literal" }],
      "validation": { "trim": true },
      "scoring": { "max_points": 1, "partial_credit": false },
      "metadata": {
        "section_id": "sec_03",
        "variant_id": "var_y4",
        "tags": ["add_sub_whole_numbers"],
        "source": { "page": 4 }
      }
    },
    {
      "item_id": "itm_sec03_y4_q02",
      "prompt": { "text": "95 - 39 = ?" },
      "answer_type": "integer",
      "answer": 56,
      "validation": { "trim": true },
      "scoring": { "max_points": 1 },
      "metadata": {
        "section_id": "sec_03",
        "variant_id": "var_y4",
        "tags": ["add_sub_whole_numbers"],
        "source": { "page": 4 }
      }
    }
  ],
  "render_templates": [
    { "template_id": "tpl_card", "name": "Card", "description": "Single prompt with single response input." },
    { "template_id": "tpl_table", "name": "Table", "description": "Grid/table entry (multi-field, anchor groups)." }
  ],
  "tags": [
    { "tag_id": "tag_add_sub_whole_numbers", "label": "Add/Sub Whole Numbers", "category": "topic" }
  ]
}

If you want the extractor to be painless in Codex: I’d keep items flat (as above) and drive everything through sections[].variants[].item_refs[]. That avoids nesting pain when you later filter, shuffle, ladder, or export.