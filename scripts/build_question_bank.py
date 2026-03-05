#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path('/home/craigjefferies/projects/maths_snapshots')
OUT_PATH = ROOT / 'data' / 'phase2-question-bank.json'


assessment = {
    'assessment_id': 'nz_phase2_maths_snapshot_2025',
    'name': '2025 Phase 2 Maths Snapshot',
    'publisher_year': 2025,
    'learning_phase': 'Phase 2',
    'intended_year_range': {'min': 4, 'max': 6},
    'notes': [
        'Formative snapshot; use sections independently.',
        'Not standardised or norm referenced.',
        'Do not complete all sections in one sitting.'
    ],
    'source': {
        'file_name': '2025 Phase 2 Maths Snapshot Answers.pdf',
        'page_count': 11
    }
}


sections = []
items = []


def n(value):
    return f'{value:,}'


def spec(prompt, answer_type, answer, source_page, accepted_answers=None, validation=None, time_limit_seconds=None, fields=None):
    row = {
        'prompt': prompt,
        'answer_type': answer_type,
        'answer': answer,
        'source_page': source_page,
    }
    if accepted_answers:
        row['accepted_answers'] = accepted_answers
    if validation:
        row['validation'] = validation
    if time_limit_seconds:
        row['time_limit_seconds'] = time_limit_seconds
    if fields:
        row['fields'] = fields
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
    time_mode='untimed',
    default_time_limit_seconds=None,
    instructions='Answer each item. Skips are allowed and tracked.'
):
    section_variants = []

    for year in sorted(variants.keys()):
        item_specs = variants[year]
        if not item_specs:
            continue

        variant_id = f'var_{section_id}_y{year}'
        refs = []
        for idx, item_spec in enumerate(item_specs, start=1):
            item_id = f'itm_{section_id}_y{year}_q{idx:02d}'
            item = {
                'item_id': item_id,
                'section_id': section_id,
                'variant_id': variant_id,
                'prompt': item_spec['prompt'],
                'answer_type': item_spec['answer_type'],
                'answer': item_spec['answer'],
                'source_page': item_spec.get('source_page', source_page),
            }
            for opt in ('accepted_answers', 'validation', 'time_limit_seconds', 'fields'):
                if opt in item_spec:
                    item[opt] = item_spec[opt]
            items.append(item)
            refs.append(item_id)

        section_variants.append({
            'variant_id': variant_id,
            'year_level': year,
            'item_refs': refs,
        })

    payload = {
        'section_id': section_id,
        'section_number': section_number,
        'title': title,
        'strand': strand,
        'topic': topic,
        'instructions': instructions,
        'time_mode': time_mode,
        'variants': section_variants,
        'mastery_thresholds': {
            'secure_pct': 80,
            'developing_pct': 50,
        },
    }

    if part:
        payload['part'] = part
    if default_time_limit_seconds:
        payload['default_time_limit_seconds'] = default_time_limit_seconds

    sections.append(payload)


# Section 1
anchors = {
    3: [870, 409],
    4: [4732, 2099],
    5: [73481, 81097],
    6: [628547, 789099],
}
expand_values = {
    3: (759, '700 + 50 + 9'),
    4: (5624, '5000 + 600 + 20 + 4'),
    5: (27431, '20000 + 7000 + 400 + 30 + 1'),
    6: (729976, '700000 + 20000 + 9000 + 900 + 70 + 6'),
}

ops = [
    ('1 more than', lambda x: x + 1),
    ('1 less than', lambda x: x - 1),
    ('10 more than', lambda x: x + 10),
    ('10 less than', lambda x: x - 10),
    ('100 more than', lambda x: x + 100),
    ('100 less than', lambda x: x - 100),
]

sec01_variants = {}
for year in (3, 4, 5, 6):
    year_rows = []
    for label, fn in ops:
        for anchor in anchors[year]:
            year_rows.append(spec(f'{label} {n(anchor)}', 'integer', fn(anchor), 2))

    base, expanded = expand_values[year]
    year_rows.append(spec(f'Expand this number: {n(base)}', 'short_text', expanded, 2))
    year_rows.append(spec(f'How many tens are in {n(base)}?', 'integer', base // 10, 2))
    year_rows.append(spec(f'How many hundreds are in {n(base)}?', 'integer', base // 100, 2))

    sec01_variants[year] = year_rows

add_section(
    section_id='sec_01',
    section_number=1,
    title='Place Value',
    strand='Number Structure',
    topic='Read and write numbers and identify 1/10/100 before and after',
    variants=sec01_variants,
    source_page=2,
)


# Section 2
add_section(
    section_id='sec_02',
    section_number=2,
    title='Round Whole Numbers and Decimals',
    strand='Number Operations',
    topic='Round whole numbers and decimals',
    source_page=3,
    variants={
        3: [
            spec('Round 759 to the nearest ten', 'integer', 760, 3),
            spec('Round 759 to the nearest hundred', 'integer', 800, 3),
        ],
        4: [
            spec('Round 5,624 to the nearest ten', 'integer', 5620, 3),
            spec('Round 5,624 to the nearest hundred', 'integer', 5600, 3),
            spec('Round 5,624 to the nearest thousand', 'integer', 6000, 3),
            spec('Round 6.4 to the nearest whole number', 'decimal', 6, 3, validation={'numeric_tolerance': 0.0001}),
        ],
        5: [
            spec('Round 27,431 to the nearest ten', 'integer', 27430, 3),
            spec('Round 27,431 to the nearest hundred', 'integer', 27400, 3),
            spec('Round 27,431 to the nearest thousand', 'integer', 27000, 3),
            spec('Round 27,431 to the nearest ten thousand', 'integer', 30000, 3),
            spec('Round 13.53 to the nearest whole number', 'decimal', 14, 3, validation={'numeric_tolerance': 0.0001}),
        ],
        6: [
            spec('Round 729,976 to the nearest ten', 'integer', 729980, 3),
            spec('Round 729,976 to the nearest hundred', 'integer', 730000, 3),
            spec('Round 729,976 to the nearest thousand', 'integer', 730000, 3),
            spec('Round 729,976 to the nearest ten thousand', 'integer', 730000, 3),
            spec('Round 13.53 to the nearest tenth', 'decimal', 13.5, 3, validation={'numeric_tolerance': 0.0001}),
        ],
    },
)


# Section 3
add_section(
    section_id='sec_03',
    section_number=3,
    title='Add and Subtract Whole Numbers',
    strand='Number Operations',
    topic='Add and subtract whole numbers',
    source_page=4,
    variants={
        3: [
            spec('37 + 18', 'integer', 55, 4),
            spec('43 - 28', 'integer', 15, 4),
        ],
        4: [
            spec('325 + 124', 'integer', 449, 4),
            spec('484 + 347', 'integer', 831, 4),
            spec('784 - 532', 'integer', 252, 4),
            spec('623 - 258', 'integer', 365, 4),
        ],
        5: [
            spec('4,125 + 377', 'integer', 4502, 4),
            spec('8,037 - 1,648', 'integer', 6389, 4),
        ],
        6: [
            spec('26,578 + 13,425', 'integer', 40003, 4),
            spec('242,527 - 58,382', 'integer', 184145, 4),
        ],
    },
)


# Section 4
sec04 = {
    3: [
        ('2 x 8', 16), ('3 x 6', 18), ('6 x 5', 30), ('7 x 10', 70), ('5 x ? = 40', 8),
        ('14 / 2', 7), ('40 / 5', 8), ('60 / 10', 6), ('24 / 3', 8), ('20 / ? = 5', 4),
    ],
    4: [
        ('4 x 6', 24), ('4 x 3', 12), ('8 x 4', 32), ('3 x 6', 18), ('6 x ? = 42', 7),
        ('24 / 6', 4), ('12 / 4', 3), ('42 / 6', 7), ('36 / 4', 9), ('16 / ? = 4', 4),
    ],
    5: [
        ('7 x 7', 49), ('6 x 8', 48), ('9 x 8', 72), ('7 x 9', 63), ('8 x ? = 56', 7),
        ('28 / 7', 4), ('56 / 8', 7), ('64 / 8', 8), ('63 / 9', 7), ('72 / ? = 8', 9),
    ],
    6: [
        ('3 x 7', 21), ('7 x 8', 56), ('9 x 6', 54), ('4 x 9', 36), ('8 x ? = 64', 8),
        ('49 / 7', 7), ('32 / 8', 4), ('27 / 3', 9), ('54 / 9', 6), ('63 / ? = 9', 7),
    ],
}

add_section(
    section_id='sec_04',
    section_number=4,
    title='Recall Multiplication and Division Facts',
    strand='Number Operations',
    topic='Basic facts recall',
    source_page=5,
    time_mode='timed_flash',
    default_time_limit_seconds=4,
    instructions='Run in timed mode. Each item can be shown for 4 seconds. Skips are allowed.',
    variants={
        year: [
            spec(prompt, 'integer', answer, 5, time_limit_seconds=4)
            for prompt, answer in rows
        ]
        for year, rows in sec04.items()
    },
)


# Section 5a
add_section(
    section_id='sec_05a',
    section_number=5,
    part='a',
    title='Multiplication Operations',
    strand='Number Operations',
    topic='Multiply whole numbers',
    source_page=6,
    variants={
        3: [
            spec('4 x 6', 'integer', 24, 6),
            spec('2 x 23', 'integer', 46, 6),
        ],
        4: [
            spec('7 x 8', 'integer', 56, 6),
            spec('54 x 3', 'integer', 162, 6),
        ],
        5: [
            spec('453 x 6', 'integer', 2718, 6),
            spec('26 x 45', 'integer', 1170, 6),
        ],
        6: [
            spec('54 x 132', 'integer', 7128, 6),
        ],
    },
)


def div_with_remainder(prompt, quotient, remainder, decimal_value):
    return spec(
        prompt,
        'short_text',
        f'{quotient} r{remainder}',
        6,
        accepted_answers=[
            {'value': f'{quotient}r{remainder}', 'kind': 'literal'},
            {'value': f'{quotient} remainder {remainder}', 'kind': 'literal'},
            {'value': decimal_value, 'kind': 'equivalent_numeric'},
            {'value': str(decimal_value), 'kind': 'equivalent_numeric'},
        ],
        validation={'numeric_tolerance': 0.001},
    )


# Section 5b
add_section(
    section_id='sec_05b',
    section_number=5,
    part='b',
    title='Division Operations',
    strand='Number Operations',
    topic='Divide whole numbers including remainders',
    source_page=6,
    variants={
        3: [
            spec('24 / 3', 'integer', 8, 6),
            spec('32 / 4', 'integer', 8, 6),
        ],
        4: [
            spec('65 / 5', 'integer', 13, 6),
            spec('252 / 3', 'integer', 84, 6),
        ],
        5: [
            div_with_remainder('79 / 3', 26, 1, 26.33333333),
            div_with_remainder('194 / 6', 32, 2, 32.33333333),
        ],
        6: [
            div_with_remainder('293 / 7', 41, 6, 41.857142857),
            div_with_remainder('4,154 / 8', 519, 2, 519.25),
        ],
    },
)


# Section 6a
sec06a_pairs = {
    4: [('0.6', '0.40'), ('0.2', '0.31'), ('0', '0.5'), ('0.2', '0.4')],
    5: [('0.7', '0.32'), ('0.27', '0.395'), ('0', '0.05'), ('0.3', '0.10')],
    6: [('0.8', '0.57'), ('0.56', '0.811'), ('0', '0.07'), ('0.4', '0.6')],
}

add_section(
    section_id='sec_06a',
    section_number=6,
    part='a',
    title='Compare and Order Decimals',
    strand='Rational Numbers',
    topic='Identify larger decimal',
    source_page=7,
    variants={
        year: [
            spec(
                f'Which is larger: {a} or {b}?',
                'decimal',
                max(float(a), float(b)),
                7,
                validation={'numeric_tolerance': 0.0001},
            )
            for a, b in pairs
        ]
        for year, pairs in sec06a_pairs.items()
    },
)


# Section 6b
add_section(
    section_id='sec_06b',
    section_number=6,
    part='b',
    title='Decimals, Fractions and Percentage Conversions',
    strand='Rational Numbers',
    topic='Convert between fractions, decimals and percentages',
    source_page=7,
    variants={
        4: [
            spec('Convert 7/10 to a decimal', 'decimal', 0.7, 7, validation={'numeric_tolerance': 0.0001}),
            spec('Convert 2/10 to a decimal', 'decimal', 0.2, 7, validation={'numeric_tolerance': 0.0001}),
            spec('Convert 8/10 to a decimal', 'decimal', 0.8, 7, validation={'numeric_tolerance': 0.0001}),
        ],
        5: [
            spec('Convert 54/100 to a decimal', 'decimal', 0.54, 7, validation={'numeric_tolerance': 0.0001}),
            spec('Convert 43/100 to a decimal', 'decimal', 0.43, 7, validation={'numeric_tolerance': 0.0001}),
            spec('Convert 3/100 to a decimal', 'decimal', 0.03, 7, validation={'numeric_tolerance': 0.0001}),
        ],
        6: [
            spec('Convert 25/100 to a decimal', 'decimal', 0.25, 7, validation={'numeric_tolerance': 0.0001}),
            spec('Convert 0.25 to a percentage', 'short_text', '25%', 7, accepted_answers=[{'value': '25', 'kind': 'literal'}]),
            spec('Convert 25% to a fraction', 'fraction', '25/100', 7, accepted_answers=[{'value': '1/4', 'kind': 'equivalent_fraction'}], validation={'fraction_equivalence': True}),
            spec('Convert 6/10 to a decimal', 'decimal', 0.6, 7, validation={'numeric_tolerance': 0.0001}),
            spec('Convert 0.6 to a percentage', 'short_text', '60%', 7, accepted_answers=[{'value': '60', 'kind': 'literal'}]),
            spec('Convert 60% to a fraction', 'fraction', '6/10', 7, accepted_answers=[{'value': '3/5', 'kind': 'equivalent_fraction'}], validation={'fraction_equivalence': True}),
            spec('Convert 85/100 to a decimal', 'decimal', 0.85, 7, validation={'numeric_tolerance': 0.0001}),
            spec('Convert 0.85 to a percentage', 'short_text', '85%', 7, accepted_answers=[{'value': '85', 'kind': 'literal'}]),
            spec('Convert 85% to a fraction', 'fraction', '85/100', 7, accepted_answers=[{'value': '17/20', 'kind': 'equivalent_fraction'}], validation={'fraction_equivalence': True}),
        ],
    },
)


# Section 7
add_section(
    section_id='sec_07',
    section_number=7,
    title='Multiply and Divide Numbers by 10 and 100',
    strand='Rational Numbers',
    topic='Scale numbers by powers of 10',
    source_page=8,
    variants={
        4: [
            spec('23 / 10', 'decimal', 2.3, 8, validation={'numeric_tolerance': 0.0001}),
            spec('137 / 10', 'decimal', 13.7, 8, validation={'numeric_tolerance': 0.0001}),
        ],
        5: [
            spec('56 / 10', 'decimal', 5.6, 8, validation={'numeric_tolerance': 0.0001}),
            spec('328 / 100', 'decimal', 3.28, 8, validation={'numeric_tolerance': 0.0001}),
        ],
        6: [
            spec('35.4 / 10', 'decimal', 3.54, 8, validation={'numeric_tolerance': 0.0001}),
            spec('75 / 100', 'decimal', 0.75, 8, validation={'numeric_tolerance': 0.0001}),
            spec('0.58 x 10', 'decimal', 5.8, 8, validation={'numeric_tolerance': 0.0001}),
            spec('6.73 x 100', 'integer', 673, 8),
        ],
    },
)


# Section 8
add_section(
    section_id='sec_08',
    section_number=8,
    title='Add and Subtract Decimals',
    strand='Rational Numbers',
    topic='Decimal addition and subtraction',
    source_page=9,
    variants={
        4: [
            spec('1.6 + 0.2', 'decimal', 1.8, 9, validation={'numeric_tolerance': 0.0001}),
            spec('0.8 + 0.4', 'decimal', 1.2, 9, validation={'numeric_tolerance': 0.0001}),
            spec('0.8 - 0.3', 'decimal', 0.5, 9, validation={'numeric_tolerance': 0.0001}),
            spec('1.3 - 0.6', 'decimal', 0.7, 9, validation={'numeric_tolerance': 0.0001}),
        ],
        5: [
            spec('2.42 + 1.5', 'decimal', 3.92, 9, validation={'numeric_tolerance': 0.0001}),
            spec('16.55 - 2.4', 'decimal', 14.15, 9, validation={'numeric_tolerance': 0.0001}),
        ],
        6: [
            spec('215.7 + 43.59', 'decimal', 259.29, 9, validation={'numeric_tolerance': 0.0001}),
            spec('42.25 - 21.83', 'decimal', 20.42, 9, validation={'numeric_tolerance': 0.0001}),
        ],
    },
)


# Section 9
add_section(
    section_id='sec_09',
    section_number=9,
    title='Convert Between Mixed Numbers and Improper Fractions',
    strand='Rational Numbers',
    topic='Mixed and improper fractions',
    source_page=10,
    variants={
        4: [
            spec('Write 11/3 as a mixed number', 'short_text', '3 2/3', 10),
            spec('Write 4 1/5 as an improper fraction', 'fraction', '21/5', 10, validation={'fraction_equivalence': True}),
        ],
        5: [
            spec('Write 23/8 as a mixed number', 'short_text', '2 7/8', 10),
            spec('Write 2 6/7 as an improper fraction', 'fraction', '20/7', 10, validation={'fraction_equivalence': True}),
        ],
        6: [
            spec('Write 34/11 as a mixed number', 'short_text', '3 1/11', 10),
            spec('Write 4 3/20 as an improper fraction', 'fraction', '83/20', 10, validation={'fraction_equivalence': True}),
        ],
    },
)


# Section 10
add_section(
    section_id='sec_10',
    section_number=10,
    title='Find a Fraction (or Percentage) of a Number',
    strand='Rational Numbers',
    topic='Fraction and percentage of amounts',
    source_page=10,
    variants={
        4: [
            spec('1/5 of 45', 'integer', 9, 10),
            spec('1/3 of 24', 'integer', 8, 10),
            spec('1/4 of 12', 'integer', 3, 10),
        ],
        5: [
            spec('3/5 of 35', 'integer', 21, 10),
            spec('5/6 of 30', 'integer', 25, 10),
            spec('2/3 of 15', 'integer', 10, 10),
        ],
        6: [
            spec('3/8 of 72', 'integer', 27, 10),
            spec('3/5 of 30', 'integer', 18, 10),
            spec('30% of 220', 'integer', 66, 10),
        ],
    },
)


# Section 11
add_section(
    section_id='sec_11',
    section_number=11,
    title='Compare, Order and Simplify Fractions',
    strand='Rational Numbers',
    topic='Fraction comparison, equivalence and simplest form',
    source_page=11,
    variants={
        4: [
            spec('Circle the larger (or =): 2/4 vs 5/8', 'fraction', '5/8', 11, validation={'fraction_equivalence': True}),
            spec('Circle the larger (or =): 2/3 vs 4/6', 'short_text', '=', 11),
            spec('Circle the larger (or =): 2/5 vs 3/10', 'fraction', '2/5', 11, validation={'fraction_equivalence': True}),
        ],
        5: [
            spec('Circle the larger (or =): 2/4 vs 5/12', 'fraction', '2/4', 11, accepted_answers=[{'value': '1/2', 'kind': 'equivalent_fraction'}], validation={'fraction_equivalence': True}),
            spec('Circle the larger (or =): 6/10 vs 42/100', 'fraction', '6/10', 11, accepted_answers=[{'value': '3/5', 'kind': 'equivalent_fraction'}], validation={'fraction_equivalence': True}),
            spec('Circle the larger (or =): 2/6 vs 4/12', 'short_text', '=', 11),
        ],
        6: [
            spec('Simplify 6/8', 'fraction', '3/4', 11, validation={'fraction_equivalence': True}),
            spec('Simplify 8/12', 'fraction', '2/3', 11, validation={'fraction_equivalence': True}),
            spec('Simplify 80/100', 'fraction', '4/5', 11, validation={'fraction_equivalence': True}),
        ],
    },
)


# Section 12
add_section(
    section_id='sec_12',
    section_number=12,
    title='Add and Subtract Fractions',
    strand='Rational Numbers',
    topic='Fraction addition and subtraction',
    source_page=11,
    variants={
        3: [
            spec('1/8 + 1/8', 'fraction', '2/8', 11, validation={'fraction_equivalence': True}),
            spec('1/3 + 1/3 + 1/3', 'fraction', '3/3', 11, validation={'fraction_equivalence': True}),
            spec('1/6 + 1/6 + 1/6 + 1/6', 'fraction', '4/6', 11, validation={'fraction_equivalence': True}),
        ],
        4: [
            spec('2/4 + 2/4', 'fraction', '4/4', 11, validation={'fraction_equivalence': True}),
            spec('1/6 + 2/6 + 2/6', 'fraction', '5/6', 11, validation={'fraction_equivalence': True}),
            spec('7/8 - 3/8', 'fraction', '4/8', 11, validation={'fraction_equivalence': True}),
        ],
        5: [
            spec('2/3 + 2/3', 'fraction', '4/3', 11, validation={'fraction_equivalence': True}),
            spec('5/6 + 2/6 + 2/6', 'fraction', '9/6', 11, validation={'fraction_equivalence': True}),
            spec('1 3/8 - 4/8', 'fraction', '7/8', 11, validation={'fraction_equivalence': True}),
        ],
        6: [
            spec('2/3 + 2/6', 'fraction', '6/6', 11, validation={'fraction_equivalence': True}),
            spec('3/8 + 1/4', 'fraction', '5/8', 11, validation={'fraction_equivalence': True}),
            spec('4/5 - 3/10', 'fraction', '5/10', 11, validation={'fraction_equivalence': True}),
        ],
    },
)


bank = {
    'schema_version': '1.0.0',
    'assessment': assessment,
    'sections': sections,
    'items': items,
}

OUT_PATH.write_text(json.dumps(bank, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')
print(f'Wrote {OUT_PATH}')
print(f'Sections: {len(sections)}')
print(f'Items: {len(items)}')
