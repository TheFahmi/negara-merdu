#!/usr/bin/env python3
"""Overlay teks Drama Musyawarah 'Kopdes atau Mall?' (720x1280 transparan).
Gaya sama dengan produksi sebelumnya: kartu judul di atas, label hijau per adegan,
kartu voting + kartu penutup di tengah. Tanpa emoji."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.expanduser("~/workspace/pinarak/konten/drama-musyawarah/overlay")
os.makedirs(OUT, exist_ok=True)
W, H = 720, 1280
BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
HIJAU = (46, 93, 67, 255)
GELAP = (10, 10, 10, 150)


def teks(draw, cx, y, s, font, fill=(255, 255, 255)):
    bbox = draw.textbbox((0, 0), s, font=font)
    w = bbox[2] - bbox[0]
    draw.text((cx - w / 2 - bbox[0], y), s, font=font, fill=fill)
    return bbox[3] - bbox[1]


def kartu(lines, nama, posisi="bawah"):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fonts, total_h = [], 0
    for s, uk, b in lines:
        f = ImageFont.truetype(BOLD if b else REG, uk)
        fonts.append((s, f))
        total_h += uk + 14
    total_h -= 14
    pad = 26
    box_w = max(d.textbbox((0, 0), s, font=f)[2] for s, f in fonts) + pad * 2
    box_h = total_h + pad * 2
    y0 = 84 if posisi == "atas" else (H - box_h) // 2 if posisi == "tengah" else H - box_h - 150
    x0 = (W - box_w) // 2
    d.rounded_rectangle([x0, y0, x0 + box_w, y0 + box_h], radius=22, fill=GELAP)
    y = y0 + pad
    for s, f in fonts:
        teks(d, W // 2, y, s, f)
        y += f.size + 14
    img.save(os.path.join(OUT, nama))
    print("overlay:", nama)


def label(s, nama):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(BOLD, 25)
    w = d.textbbox((0, 0), s, font=f)[2]
    d.rounded_rectangle([28, 40, 28 + w + 36, 40 + 46], radius=23, fill=HIJAU)
    d.text((28 + 18, 40 + 9), s, font=f, fill=(255, 255, 255))
    img.save(os.path.join(OUT, nama))
    print("overlay:", nama)


kartu([("DRAMA: MUSYAWARAH WARGA", 40, True), ("KOPDES ATAU MALL?", 40, True),
       ("Dua usulan, satu keputusan", 30, False)], "o1_judul.png", "atas")
label("PAK PRESIDEN — ISTANA NEGARA", "o_lab_presiden.png")
label("BLOK 997 — LAHAN KOPERASI DESA", "o_lab_kopdes.png")
label("USULAN ALDI SAPUTRA", "o_lab_kopdes2.png")
label("BLOK 2917 — LAHAN MERDU MALL", "o_lab_mall.png")
label("USULAN @4caa_caaaee", "o_lab_mall2.png")
label("@drennvanzz_ — TIM KOPDES", "o_lab_dren.png")
label("@4caa_caaaee — TIM MALL", "o_lab_hafsah.png")
kartu([("VOTING DIBUKA", 40, True), ("Tulis KOPDES atau MALL", 34, True),
       ("di komentar video ini", 30, False)], "o_voting.png", "tengah")
kartu([("YANG FOLLOW BUKAN PENONTON", 34, True), ("TAPI WARGA.", 34, True),
       ("Daftar di merdu.id", 30, False)], "o_penutup.png", "tengah")
print("selesai")
