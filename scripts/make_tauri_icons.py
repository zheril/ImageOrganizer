#!/usr/bin/env python3
"""Generate Tauri icon set from the existing Cosvault icon-512.png.

Tauri expects:
- icons/32x32.png
- icons/128x128.png
- icons/128x128@2x.png  (= 256x256)
- icons/icon.icns  (macOS)
- icons/icon.ico   (Windows, multi-resolution)

Run: python scripts/make_tauri_icons.py
"""
import os
from PIL import Image

SRC = "/home/z/my-project/public/icon-512.png"
DST_DIR = "/home/z/my-project/src-tauri/icons"

def main():
    os.makedirs(DST_DIR, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")

    # PNG sizes
    for label, size in [("32x32", 32), ("128x128", 128), ("128x128@2x", 256)]:
        out = src.resize((size, size), Image.LANCZOS)
        path = os.path.join(DST_DIR, f"{label}.png")
        out.save(path, "PNG")
        print(f"Wrote {path}")

    # Windows .ico (multi-resolution)
    ico_path = os.path.join(DST_DIR, "icon.ico")
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    src.save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
    )
    print(f"Wrote {ico_path}")

    # macOS .icns (Pillow can write ICNS with multiple sizes)
    icns_path = os.path.join(DST_DIR, "icon.icns")
    try:
        # ICNS supports 32, 64, 128, 256, 512, 1024
        # Pillow takes the source image and writes supported sizes automatically
        src.save(icns_path, format="ICNS")
        print(f"Wrote {icns_path}")
    except Exception as e:
        print(f"WARN: Could not write ICNS ({e}). Run `bunx tauri icon {SRC}` to regenerate.")

if __name__ == "__main__":
    main()
