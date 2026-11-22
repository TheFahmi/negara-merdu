#!/usr/bin/env python3
"""Buat PNG overlay teks Episode 1 (720x1280, transparan) untuk ffmpeg."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.expanduser("~/workspace/pinarak/konten/episode1/overlay")
os.makedirs(OUT, exist_ok=True)
W, H = 720, 1280
BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"


def teks(draw, cx, y, s, font, fill=(255, 255, 255)):
    bbox = draw.textbbox((0, 0), s, font=font)
    w = bbox[2] - bbox[0]
    draw.text((cx - w / 2 - bbox[0], y), s, font=font, fill=fill)
    return bbox[3] - bbox[1]


def kartu(lines, nama, posisi="bawah"):
    """lines: list of (teks, ukuran, bold?). posisi: 'atas'|'bawah'|'tengah'."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fonts = []
    total_h = 0
    for s, uk, b in lines:
        f = ImageFont.truetype(BOLD if b else REG, uk)
        fonts.append((s, f))
        total_h += uk + 14
    total_h -= 14
    pad = 26
    box_w = 0
    for s, f in fonts:
        box_w = max(box_w, d.textbbox((0, 0), s, font=f)[2])
    box_w += pad * 2
    box_h = total_h + pad * 2
    if posisi == "atas":
        y0 = 84
    elif posisi == "tengah":
        y0 = (H - box_h) // 2
    else:
        y0 = H - box_h - 150
    x0 = (W - box_w) // 2
    d.rounded_rectangle([x0, y0, x0 + box_w, y0 + box_h], radius=22, fill=(10, 10, 10, 148))
    y = y0 + pad
    for s, f in fonts:
        teks(d, W // 2, y, s, f)
        y += f.size + 14
    img.save(os.path.join(OUT, nama))
    print("overlay:", nama)


kartu([("EPISODE 1", 40, True), ("DESA PINARAK BARU BERDIRI", 37, True)], "t1_judul.png", "atas")
kartu([("99.999 kavling masih kosong", 36, True)], "t2_kavling.png", "bawah")
kartu([("Warga pertama: @thefahmihassan", 34, True), ("Rumah No. 1", 34, False)], "t3_warga.png", "bawah")
kartu([("Komen bangunan yang kamu mau —", 33, True), ("like terbanyak dibangun duluan", 33, True)], "t4_komen.png", "bawah")
kartu([("Follow @desapinarak", 40, True), ("Daftar di pinarak.mfah.me", 36, True),
       ("Dapat rumah, KTP & Kartu Keluarga", 30, False)], "t5_penutup.png", "tengah")
print("selesai")
