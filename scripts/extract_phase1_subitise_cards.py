#!/usr/bin/env python3
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path("/home/craigjefferies/projects/maths_snapshots")
PDF_PATH = ROOT / "docs" / "2025 Phase 1 Maths Snapshots recording sheet4.docx.pdf"
OUT_DIR = ROOT / "assets" / "phase1-subitise"


# Crop boxes are defined on a 4x render of page 1.
ROW_BOX = (80, 1380, 3300, 1920)

# Card boxes are defined relative to the subitise row crop and trimmed to the visible dot pattern.
CARD_BOXES = {
    "3a": (460, 90, 680, 260),
    "3b": (680, 90, 920, 260),
    "3c": (915, 90, 1135, 260),
    "3d": (1140, 90, 1520, 260),
    "3e": (1520, 90, 1860, 260),
    "3f": (1870, 90, 2580, 260),
    "3g": (2580, 90, 3160, 260),
}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(PDF_PATH)
    page = doc.load_page(0)
    pix = page.get_pixmap(matrix=fitz.Matrix(4, 4), alpha=False)
    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples).crop(ROW_BOX)
    for name, box in CARD_BOXES.items():
        cropped = image.crop(box)
        cropped.save(OUT_DIR / f"{name}.png")


if __name__ == "__main__":
    main()
