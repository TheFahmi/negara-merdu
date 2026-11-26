#!/usr/bin/env python3
"""Cover Episode 5: cover.jpg (frame dasar di-upscale 720x1280) + cover_teks.jpg
(pita hijau Negara Merdu 46,93,67 + lis emas 217,164,65; teks diukur fit, anti-kepotong).
Pakai: python3 buat_cover5.py <frame_dasar.jpg>"""
from PIL import Image, ImageDraw, ImageFont
import os, sys

BASE = os.path.expanduser("~/workspace/pinarak/konten/episode5")
FP = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
W, H = 720, 1280

img = Image.open(sys.argv[1]).convert("RGB").resize((W, H), Image.LANCZOS)
img.save(os.path.join(BASE, "cover.jpg"), quality=92)

d = ImageDraw.Draw(img, "RGBA")

def fit(text, target_w, start):
    sz = start
    while sz > 10:
        f = ImageFont.truetype(FP, sz)
        if d.textlength(text, font=f) <= target_w:
            return f
        sz -= 2
    return ImageFont.truetype(FP, sz)

lines = [
    ("NEGARA MERDU", 0.034, (217, 164, 65)),
    ("EPISODE 5", 0.088, (255, 255, 255)),
    ("40 WARGA", 0.034, (240, 230, 200)),
]
maxw = W - 96
items = []
for text, rel, color in lines:
    f = fit(text, maxw, int(H * rel))
    asc, desc = f.getmetrics()
    items.append((text, f, asc + desc, color))

gap = int(H * 0.014)
total = sum(h for _, _, h, _ in items) + gap * (len(items) - 1)
band_h = int(H * 0.30)
band_top = H - band_h
d.rectangle([0, band_top, W, H], fill=(46, 93, 67, 255))
d.rectangle([0, band_top, W, band_top + max(4, H // 160)], fill=(217, 164, 65, 255))

y = band_top + (band_h - total) // 2
for text, f, h, color in items:
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=color)
    y += h + gap

out = os.path.join(BASE, "cover_teks.jpg")
img.save(out, quality=92)
print("cover.jpg + cover_teks.jpg tersimpan; blok teks", total, "px di pita", band_h, "px")
