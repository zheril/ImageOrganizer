#!/usr/bin/env python3
"""Generate PWA icons for Cosvault — a violet gradient rounded square with a 4-point sparkle."""
from PIL import Image, ImageDraw
import math
import os

def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c_top = (139, 92, 246, 255)
    c_bot = (217, 70, 239, 255)
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(c_top[0] * (1 - t) + c_bot[0] * t)
        g = int(c_top[1] * (1 - t) + c_bot[1] * t)
        b = int(c_top[2] * (1 - t) + c_bot[2] * t)
        ImageDraw.Draw(grad).line([(0, y), (size, y)], fill=(r, g, b, 255))

    radius = int(size * 0.22)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.paste(grad, (0, 0), mask)

    cx, cy = size / 2, size / 2
    r_outer = size * 0.28
    r_inner = size * 0.10
    points = []
    for i in range(8):
        angle = math.pi / 2 * i + math.pi / 2
        r = r_outer if i % 2 == 0 else r_inner
        points.append((cx + r * math.cos(angle), cy - r * math.sin(angle)))
    star = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(star).polygon(points, fill=(255, 255, 255, 255))
    img.alpha_composite(star)
    return img


def main():
    out_dir = "/home/z/my-project/public"
    os.makedirs(out_dir, exist_ok=True)
    for size in [192, 512]:
        icon = make_icon(size)
        out = os.path.join(out_dir, f"icon-{size}.png")
        icon.save(out, "PNG")
        print(f"Wrote {out} ({size}x{size})")
    icon = make_icon(180)
    out = os.path.join(out_dir, "apple-touch-icon.png")
    icon.save(out, "PNG")
    print(f"Wrote {out} (180x180)")


if __name__ == "__main__":
    main()
