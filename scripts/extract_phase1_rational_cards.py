#!/usr/bin/env python3
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path("/home/craigjefferies/projects/maths_snapshots")
PDF_PATH = ROOT / "docs" / "2025 Phase 1 Maths Snapshots recording sheet4.docx.pdf"
OUT_DIR = ROOT / "assets" / "phase1-rational"

ROW_BOX = (40, 1450, 3300, 2320)
CARD_BOXES = {
    "half": (450, 420, 680, 620),
    "quarter": (800, 420, 1020, 680),
    "eighth": (1230, 420, 1640, 680),
    "fifth": (1980, 420, 2210, 680),
    "third": (2360, 420, 2570, 680),
    "sixth": (2810, 420, 3040, 680),
}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(PDF_PATH)
    page = doc.load_page(1)
    pix = page.get_pixmap(matrix=fitz.Matrix(4, 4), alpha=False)
    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples).crop(ROW_BOX)

    for name, box in CARD_BOXES.items():
        image.crop(box).save(OUT_DIR / f"{name}.png")


if __name__ == "__main__":
    main()
