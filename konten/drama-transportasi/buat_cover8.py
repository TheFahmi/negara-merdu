#!/usr/bin/env python3
"""Cover Drama Transportasi Negara Merdu.
- cover.jpg: frame capture Alienware (bus Trans Merdu tiba di Halte Plaza, warga menunggu).
- cover_teks.jpg: cover.jpg + pita hijau (46,93,67) + lis emas (217,164,65) di 30% bawah,
  kicker emas "NEGARA MERDU", judul putih, sub krem. Teks diukur fit (lebar <= W-96),
  blok dipusatkan vertikal di pita — tidak kepotong tepi."""
from PIL import Image, ImageDraw, ImageFont
import os

D = os.path.expanduser("~/workspace/pinarak/konten/drama-transportasi")
SRC = os.path.join(D, "frames_aw", "hl_0023.jpg")
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

img = Image.open(SRC).convert("RGB")
W, H = img.size
assert (W, H) == (720, 1280), (W, H)
img.save(os.path.join(D, "cover.jpg"), quality=90)
print("cover.jpg dari", SRC)

HIJAU = (46, 93, 67)
EMAS = (217, 164, 65)
PUTIH = (255, 255, 255)
KREM = (240, 230, 200)

pita_h = int(H * 0.30)
y0 = H - pita_h
d = ImageDraw.Draw(img)
d.rectangle([0, y0, W, H], fill=HIJAU)
d.rectangle([0, y0, W, y0 + 6], fill=EMAS)


def pas(teks, target):
    uk = target
    while uk > 12:
        f = ImageFont.truetype(BOLD, uk)
        if d.textbbox((0, 0), teks, font=f)[2] <= W - 96:
            return f
        uk -= 2
    return ImageFont.truetype(BOLD, uk)


baris = [
    ("NEGARA MERDU", pas("NEGARA MERDU", 34), EMAS, 16),
    ("DRAMA: HARI PERTAMA", pas("DRAMA: HARI PERTAMA", 92), PUTIH, 20),
    ("TRANS MERDU", pas("TRANS MERDU", 92), PUTIH, 20),
    ("Bus & KRL resmi beroperasi", pas("Bus & KRL resmi beroperasi", 44), KREM, 0),
]
total = 0
for teks, f, warna, jarak in baris:
    bb = d.textbbox((0, 0), teks, font=f)
    total += (bb[3] - bb[1]) + jarak
y = y0 + (pita_h - total) // 2
for teks, f, warna, jarak in baris:
    bb = d.textbbox((0, 0), teks, font=f)
    w = bb[2] - bb[0]
    h = bb[3] - bb[1]
    d.text(((W - w) // 2 - bb[0], y - bb[1]), teks, font=f, fill=warna)
    y += h + jarak
img.save(os.path.join(D, "cover_teks.jpg"), quality=92)
print("cover_teks.jpg selesai; pita y0 =", y0, "tinggi blok teks =", total)
