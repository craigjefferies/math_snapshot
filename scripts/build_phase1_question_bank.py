#!/usr/bin/env python3
import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path("/home/craigjefferies/projects/maths_snapshots")
OUT_PATH = ROOT / "data" / "phase1-question-bank.json"
SCHEMA_PATH = ROOT / "schemas" / "question-bank.schema.json"


assessment = {
    "assessment_id": "nz_phase1_maths_snapshot_2025",
    "name": "2025 Phase 1 Maths Snapshot",
    "publisher_year": 2025,
    "learning_phase": "Phase 1",
    "intended_year_range": {"min": 0, "max": 3},
    "notes": [
        "Formative snapshot; use sections independently.",
        "Teacher-led digital version aligned to the raw Phase 1 recording sheet.",
        "Phase 1 supports observed-success recording because many tasks are demonstrated orally or with materials."
    ],
    "source": {
        "file_name": "2025 Phase 1 Maths Snapshots recording sheet4.docx.pdf",
        "page_count": 2
    }
}

sections = []
items = []


def spec(prompt, answer_type, answer, source_page, accepted_answers=None, validation=None, fields=None, media=None):
    row = {
        "prompt": prompt,
        "answer_type": answer_type,
        "answer": answer,
        "source_page": source_page,
    }
    if accepted_answers:
        row["accepted_answers"] = accepted_answers
    if validation:
        row["validation"] = validation
    if fields:
        row["fields"] = fields
    if media:
        row["media"] = media
    return row


def add_section(
    section_id,
    section_number,
    title,
    strand,
    topic,
    variants,
    source_page,
    part=None,
    instructions="Teacher-led task. Type a response when useful, or use observed-success recording."
):
    section_variants = []
    for year in sorted(variants.keys()):
        item_specs = variants[year]
        if not item_specs:
            continue

        variant_id = f"var_{section_id}_y{year}"
        refs = []
        for idx, item_spec in enumerate(item_specs, start=1):
            item_id = f"itm_{section_id}_y{year}_q{idx:02d}"
            item = {
                "item_id": item_id,
                "section_id": section_id,
                "variant_id": variant_id,
                "prompt": item_spec["prompt"],
                "answer_type": item_spec["answer_type"],
                "answer": item_spec["answer"],
                "source_page": item_spec.get("source_page", source_page),
            }
            for opt in ("accepted_answers", "validation", "fields"):
                if opt in item_spec:
                    item[opt] = item_spec[opt]
            if "media" in item_spec:
                item["media"] = item_spec["media"]
            items.append(item)
            refs.append(item_id)

        section_variants.append({
            "variant_id": variant_id,
            "year_level": year,
            "item_refs": refs,
        })

    payload = {
        "section_id": section_id,
        "section_number": section_number,
        "title": title,
        "strand": strand,
        "topic": topic,
        "instructions": instructions,
        "variants": section_variants,
        "mastery_thresholds": {
            "secure_pct": 80,
            "developing_pct": 50,
        },
    }
    if part:
        payload["part"] = part
    sections.append(payload)


def sequence_answers(numbers):
    base = " ".join(str(n) for n in numbers)
    comma = ", ".join(str(n) for n in numbers)
    return [
        {"value": base, "kind": "literal"},
        {"value": comma, "kind": "literal"},
    ]


def image_media(src, alt):
    return {
        "kind": "image",
        "src": src,
        "alt": alt,
    }


# 1. Counting
add_section(
    section_id="sec_01",
    section_number=1,
    title="Counting",
    strand="Number Structure",
    topic="Count forwards and backwards across increasing number ranges",
    source_page=1,
    variants={
        0: [
            spec("Count forwards from 1. Type the next numbers up to 10.", "short_text", "2 3 4 5 6 7 8 9 10", 1, accepted_answers=sequence_answers([2, 3, 4, 5, 6, 7, 8, 9, 10])),
            spec("Count backwards from 10. Type the numbers down to 1.", "short_text", "9 8 7 6 5 4 3 2 1", 1, accepted_answers=sequence_answers([9, 8, 7, 6, 5, 4, 3, 2, 1])),
        ],
        1: [
            spec("Count forwards from 11. Type the next numbers up to 20.", "short_text", "12 13 14 15 16 17 18 19 20", 1, accepted_answers=sequence_answers([12, 13, 14, 15, 16, 17, 18, 19, 20])),
            spec("Count backwards from 20. Type the numbers down to 11.", "short_text", "19 18 17 16 15 14 13 12 11", 1, accepted_answers=sequence_answers([19, 18, 17, 16, 15, 14, 13, 12, 11])),
        ],
        2: [
            spec("Count forwards from 46. Type the next eight numbers.", "short_text", "47 48 49 50 51 52 53 54", 1, accepted_answers=sequence_answers([47, 48, 49, 50, 51, 52, 53, 54])),
            spec("Count backwards from 84. Type the next eight numbers.", "short_text", "83 82 81 80 79 78 77 76", 1, accepted_answers=sequence_answers([83, 82, 81, 80, 79, 78, 77, 76])),
        ],
        3: [
            spec("Count forwards from 387. Type the next numbers up to 402.", "short_text", "388 389 390 391 392 393 394 395 396 397 398 399 400 401 402", 1, accepted_answers=sequence_answers([388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 402])),
            spec("Count backwards from 604. Type the next seven numbers.", "short_text", "603 602 601 600 599 598 597", 1, accepted_answers=sequence_answers([603, 602, 601, 600, 599, 598, 597])),
        ],
    },
)


# 2. Identify numbers / before / after
add_section(
    section_id="sec_02",
    section_number=2,
    title="Identify Numbers",
    strand="Number Structure",
    topic="Recognise numerals and find the number before and after",
    source_page=1,
    variants={
        0: [
            spec("What is this number? 1", "integer", 1, 1),
            spec("What number comes after 1?", "integer", 2, 1),
            spec("What is this number? 3", "integer", 3, 1),
            spec("What number comes before 3?", "integer", 2, 1),
            spec("What is this number? 6", "integer", 6, 1),
            spec("What number comes after 6?", "integer", 7, 1),
            spec("What is this number? 9", "integer", 9, 1),
            spec("What number comes before 9?", "integer", 8, 1),
        ],
        1: [
            spec("What is this number? 12", "integer", 12, 1),
            spec("What number comes after 12?", "integer", 13, 1),
            spec("What is this number? 14", "integer", 14, 1),
            spec("What number comes before 14?", "integer", 13, 1),
            spec("What is this number? 16", "integer", 16, 1),
            spec("What number comes after 16?", "integer", 17, 1),
            spec("What is this number? 19", "integer", 19, 1),
            spec("What number comes before 19?", "integer", 18, 1),
        ],
        2: [
            spec("What is this number? 29", "integer", 29, 1),
            spec("What number comes after 29?", "integer", 30, 1),
            spec("What is this number? 36", "integer", 36, 1),
            spec("What number comes before 36?", "integer", 35, 1),
            spec("What is this number? 41", "integer", 41, 1),
            spec("What number comes after 41?", "integer", 42, 1),
            spec("What is this number? 80", "integer", 80, 1),
            spec("What number comes before 80?", "integer", 79, 1),
        ],
        3: [
            spec("What is this number? 100", "integer", 100, 1),
            spec("What number comes after 100?", "integer", 101, 1),
            spec("What is this number? 137", "integer", 137, 1),
            spec("What number comes before 137?", "integer", 136, 1),
            spec("What is this number? 409", "integer", 409, 1),
            spec("What number comes after 409?", "integer", 410, 1),
            spec("What is this number? 870", "integer", 870, 1),
            spec("What number comes before 870?", "integer", 869, 1),
            spec("What is this number? 999", "integer", 999, 1),
            spec("What number comes before 999?", "integer", 998, 1),
        ],
    },
)


# 3. Subitise
add_section(
    section_id="sec_03",
    section_number=3,
    title="Subitise",
    strand="Number Structure",
    topic="Recognise quantities without counting using the Subitise cards",
    source_page=1,
    instructions="Teacher-led observation task. Show the Subitise card, then type the student's answer or tick observed-success when they show the quantity correctly.",
    variants={
        0: [
            spec(
                "How many dots are there?",
                "integer",
                3,
                1,
                media=image_media("assets/phase1-subitise/3a.png", "Subitise card 3A showing three dots.")
            ),
        ],
        1: [
            spec(
                "How many dots are there?",
                "integer",
                5,
                1,
                media=image_media("assets/phase1-subitise/3b.png", "Subitise card 3B showing five dots.")
            ),
            spec(
                "How many dots are there?",
                "integer",
                4,
                1,
                media=image_media("assets/phase1-subitise/3c.png", "Subitise card 3C showing four dots.")
            ),
        ],
        2: [
            spec(
                "How many dots are there?",
                "integer",
                8,
                1,
                media=image_media("assets/phase1-subitise/3d.png", "Subitise card 3D showing eight dots in grouped rows.")
            ),
            spec(
                "How many dots are there?",
                "integer",
                6,
                1,
                media=image_media("assets/phase1-subitise/3e.png", "Subitise card 3E showing six dots in two groups.")
            ),
        ],
        3: [
            spec(
                "About how many dots are there?",
                "integer",
                10,
                1,
                accepted_answers=[{"value": value, "kind": "equivalent_numeric"} for value in range(9, 12)],
                media=image_media("assets/phase1-subitise/3f.png", "Subitise card 3F showing about ten dots in grouped clusters.")
            ),
            spec(
                "About how many dots are there?",
                "integer",
                54,
                1,
                accepted_answers=[{"value": value, "kind": "equivalent_numeric"} for value in range(48, 61)],
                media=image_media("assets/phase1-subitise/3g.png", "Subitise card 3G showing a larger collection of grouped dots.")
            ),
        ],
    },
)


# 4. Place value
add_section(
    section_id="sec_04",
    section_number=4,
    title="Place Value",
    strand="Number Structure",
    topic="Use base-10 groupings to interpret quantities",
    source_page=1,
    variants={
        1: [
            spec("Here are 5 flowers. Here are 10 more flowers. How many flowers are there altogether?", "integer", 15, 1),
        ],
        2: [
            spec("How many bags of 10 lollies can you make with 50 lollies?", "integer", 5, 1),
        ],
        3: [
            spec(
                "How many groups of 10 can you make with 83 sticks?",
                "integer",
                8,
                1,
                media=image_media("assets/phase1-place-value/sticks.png", "A small bundle of sticks used for the place-value question.")
            ),
            spec(
                "A phone costs $270. How many $10 notes do you need to pay for it?",
                "integer",
                27,
                1,
                media=image_media("assets/phase1-place-value/phone.png", "A phone image used for the $270 place-value question.")
            ),
        ],
    },
)


# 5a. Basic facts to 10 (Year 2)
add_section(
    section_id="sec_05a",
    section_number=5,
    part="a",
    title="Add/Sub Basic Facts to 10",
    strand="Number Operations",
    topic="Recall addition and subtraction facts to 10",
    source_page=2,
    variants={
        2: [
            spec("6 + 1", "integer", 7, 2),
            spec("5 + 0", "integer", 5, 2),
            spec("4 - 1", "integer", 3, 2),
            spec("2 + 3", "integer", 5, 2),
            spec("1 + 4", "integer", 5, 2),
            spec("5 - 2", "integer", 3, 2),
            spec("5 - 4", "integer", 1, 2),
            spec("5 + 4", "integer", 9, 2),
            spec("2 + 5", "integer", 7, 2),
            spec("8 - 3", "integer", 5, 2),
            spec("3 + 3", "integer", 6, 2),
            spec("4 + 4", "integer", 8, 2),
            spec("6 - 3", "integer", 3, 2),
            spec("2 + 8", "integer", 10, 2),
            spec("7 + ? = 10", "integer", 3, 2),
            spec("10 - 4", "integer", 6, 2),
            spec("3 + 4", "integer", 7, 2),
            spec("2 + 6", "integer", 8, 2),
            spec("9 - 3", "integer", 6, 2),
            spec("8 - 6", "integer", 2, 2),
        ],
    },
)


# 5b. Basic facts to 20 (Year 3)
add_section(
    section_id="sec_05b",
    section_number=5,
    part="b",
    title="Add/Sub Basic Facts to 20",
    strand="Number Operations",
    topic="Recall addition and subtraction facts to 20",
    source_page=2,
    variants={
        3: [
            spec("10 + 8", "integer", 18, 2),
            spec("17 - 7", "integer", 10, 2),
            spec("14 - 10", "integer", 4, 2),
            spec("7 + 7", "integer", 14, 2),
            spec("9 + 9", "integer", 18, 2),
            spec("16 - 8", "integer", 8, 2),
            spec("5 + 6", "integer", 11, 2),
            spec("8 + 7", "integer", 15, 2),
            spec("9 + 6", "integer", 15, 2),
            spec("6 + 8", "integer", 14, 2),
            spec("7 + 5", "integer", 12, 2),
            spec("5 + 9", "integer", 14, 2),
            spec("14 - 5", "integer", 9, 2),
            spec("17 - 8", "integer", 9, 2),
            spec("12 - 5", "integer", 7, 2),
            spec("15 - 9", "integer", 6, 2),
        ],
    },
)


# 6. Add/Sub operations
add_section(
    section_id="sec_06",
    section_number=6,
    title="Add / Sub Operations",
    strand="Number Operations",
    topic="Join and separate quantities across increasing number ranges",
    source_page=2,
    variants={
        0: [
            spec("Get 9 counters. Type 9 to show you formed the set.", "integer", 9, 2),
        ],
        1: [
            spec("4 + 3", "integer", 7, 2),
            spec("8 - 2", "integer", 6, 2),
        ],
        2: [
            spec("9 + 7", "integer", 16, 2),
            spec("7 + ? = 11", "integer", 4, 2),
            spec("13 - 4", "integer", 9, 2),
            spec("53 + 21", "integer", 74, 2),
            spec("65 - 32", "integer", 33, 2),
        ],
        3: [
            spec("37 + 18", "integer", 55, 2),
            spec("43 - 28", "integer", 15, 2),
        ],
    },
)


# 7a. Multiplication and division: Y1-2 operations or Y3 basic facts recall
add_section(
    section_id="sec_07a",
    section_number=7,
    part="a",
    title="Multiplication and Division",
    strand="Number Operations",
    topic="Y1-2 operations or Y3 basic facts recall",
    source_page=2,
    instructions="Teacher-led task. Use typed input or observed-success. For the strategy row, record success by observation.",
    variants={
        1: [
            spec("8 × 2", "integer", 16, 2),
            spec("14 ÷ 2", "integer", 7, 2),
            spec("7 × 10", "integer", 70, 2),
            spec("60 ÷ 10", "integer", 6, 2),
            spec("Strategy used: share / count in 1s", "short_text", "", 2),
        ],
        2: [
            spec("6 × 5", "integer", 30, 2),
            spec("40 ÷ 5", "integer", 8, 2),
            spec("6 × 3", "integer", 18, 2),
            spec("24 ÷ 3", "integer", 8, 2),
            spec("Strategy used: skip count", "short_text", "", 2),
        ],
        3: [
            spec("Strategy used: recall basic fact", "short_text", "", 2),
        ],
    },
)


# 7b. Multiplication and division operations
add_section(
    section_id="sec_07b",
    section_number=7,
    part="b",
    title="Multiplication and Division Operations",
    strand="Number Operations",
    topic="Multiply 1 x 2 digit numbers and divide by 1-digit divisors with no remainders",
    source_page=2,
    instructions="Teacher-led task. Use typed input or observed-success.",
    variants={
        3: [
            spec("4 × 6", "integer", 24, 2),
            spec("2 × 23", "integer", 46, 2),
            spec("32 ÷ 4", "integer", 8, 2),
        ],
    },
)


# 8. Rational numbers
add_section(
    section_id="sec_08",
    section_number=8,
    title="Rational Numbers",
    strand="Rational Numbers",
    topic="Identify and find simple fractions of sets",
    source_page=2,
    variants={
        1: [
            spec(
                "What fraction is shaded?",
                "fraction",
                "1/2",
                2,
                validation={"fraction_equivalence": True},
                media=image_media("assets/phase1-rational/half.png", "A triangle split into two equal parts with one half shaded.")
            ),
            spec(
                "What fraction is shaded?",
                "fraction",
                "1/4",
                2,
                validation={"fraction_equivalence": True},
                media=image_media("assets/phase1-rational/quarter.png", "A rectangle split into four equal parts with one quarter shaded.")
            ),
        ],
        2: [
            spec(
                "What fraction is shaded?",
                "fraction",
                "1/8",
                2,
                validation={"fraction_equivalence": True},
                media=image_media("assets/phase1-rational/eighth.png", "A rectangle split into eight equal parts with one eighth shaded.")
            ),
            spec("Find 1/4 of 12.", "integer", 3, 2),
        ],
        3: [
            spec(
                "What fraction is shaded?",
                "fraction",
                "1/5",
                2,
                validation={"fraction_equivalence": True},
                media=image_media("assets/phase1-rational/fifth.png", "A circle split into five equal parts with one fifth shaded.")
            ),
            spec(
                "What fraction is shaded?",
                "fraction",
                "1/3",
                2,
                validation={"fraction_equivalence": True},
                media=image_media("assets/phase1-rational/third.png", "A rectangle split into three equal parts with one third shaded.")
            ),
            spec(
                "What fraction is shaded?",
                "fraction",
                "1/6",
                2,
                validation={"fraction_equivalence": True},
                media=image_media("assets/phase1-rational/sixth.png", "A rectangle split into six equal parts with one sixth shaded.")
            ),
            spec("Find 1/3 of 15.", "integer", 5, 2),
        ],
    },
)


bank = {
    "schema_version": "1.0.0",
    "assessment": assessment,
    "sections": sections,
    "items": items,
}

OUT_PATH.write_text(json.dumps(bank, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
Draft202012Validator(json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))).validate(bank)
print(f"Wrote {OUT_PATH}")
print(f"Sections: {len(sections)}")
print(f"Items: {len(items)}")
print("Schema: valid")
