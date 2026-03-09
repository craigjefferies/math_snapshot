#!/usr/bin/env python3
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path("/home/craigjefferies/projects/maths_snapshots")
PDF_PATH = ROOT / "docs" / "2025 Phase 1 Maths Snapshots recording sheet4.docx.pdf"
OUT_DIR = ROOT / "assets" / "phase1-place-value"

CARD_BOXES = {
    "sticks": (2210, 1970, 2490, 2160),
    "phone": (3210, 1960, 3325, 2165),
}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(PDF_PATH)
    page = doc.load_page(0)
    pix = page.get_pixmap(matrix=fitz.Matrix(4, 4), alpha=False)
    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    for name, box in CARD_BOXES.items():
        image.crop(box).save(OUT_DIR / f"{name}.png")


if __name__ == "__main__":
    main()
