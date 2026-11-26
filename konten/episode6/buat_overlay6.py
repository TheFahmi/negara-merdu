#!/usr/bin/env python3
"""Buat PNG overlay teks Episode 6 Negara Merdu (720x1280, transparan) untuk ffmpeg.
Data live 24 Nov 2026: 46 warga; absen baru #41-46 semua di Blok 1881;
kas 113 like = Rp2.130.000; target Apartemen Blok 2120 Rp50.000.000;
usulan antre: Kopdes (Aldi Saputra) + Mall (@4caa_caaaee)."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.expanduser("~/workspace/pinarak/konten/episode6/overlay")
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


kartu([("EPISODE 6", 44, True), ("NEGARA MERDU — 46 WARGA", 37, True)], "o1_judul.png", "atas")
kartu([("ABSEN WARGA BARU", 38, True), ("Enam warga baru, semua di Blok 1881", 28, False)], "o2_absen_judul.png", "atas")
kartu([("@eka_catherine_ · Rumah No. 41 · Kav 16", 29, True),
       ("@ramadaniferlita · Rumah No. 42 · Kav 17", 29, True),
       ("@dubaicwikuki4life · Rumah No. 43 · Kav 18", 29, True)], "o3_absen1.png", "bawah")
kartu([("@asila_cill · Rumah No. 44 · Kav 19", 29, True),
       ("@xyjr.naaa · Rumah No. 45 · Kav 20", 29, True),
       ("@pricilliady · Rumah No. 46 · Kav 21", 29, True)], "o4_absen2.png", "bawah")
kartu([("LAPORAN KAS NEGARA", 38, True), ("Like terkumpul: 113 × Rp10.000", 32, True),
       ("Kas sekarang: Rp2.130.000", 34, True),
       ("Target besar: Apartemen Blok 2120", 29, False),
       ("Rp50.000.000 — dari like & share kalian", 29, False)], "o5_kas.png", "bawah")
kartu([("USULAN YANG MASIH ANTRE", 34, True),
       ("Kopdes — Aldi Saputra", 30, True),
       ("Mall — @4caa_caaaee", 30, True),
       ("Like usulan favoritmu, atau tulis usulanmu", 27, False)], "o6_voting.png", "bawah")
kartu([("MENUJU 100 WARGA", 40, True), ("Akan ada PERAYAAN 100 WARGA", 33, True),
       ("Yang follow bukan penonton — tapi warga.", 30, True),
       ("Daftar di merdu.id", 30, False),
       ("Pemilu dibuka di 10.000 warga", 28, False)], "o7_penutup.png", "tengah")
print("selesai")
