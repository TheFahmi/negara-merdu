#!/usr/bin/env python3
"""Buat PNG overlay teks Episode 4 Negara Merdu (720x1280, transparan) untuk ffmpeg.
Data live 22 Nov 2026: 34 warga (absen baru #33 @koala4011937, #34 @salsalsa759),
kas 77 like = Rp770.000, target Lapangan Rp8.000.000, usulan berjalan: kopdes (Aldi Saputra).
Dua bangunan baru: Taman Wah Blok 1879 (usulan @hana_kaemung) + Toko Pancing Blok 1882
(owner @drennvanzz_, lengkap kolam pancing). Milestone: Perayaan 100 Warga."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.expanduser("~/workspace/pinarak/konten/episode4/overlay")
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


kartu([("EPISODE 4", 40, True), ("NEGARA MERDU — 34 WARGA", 37, True)], "o1_judul.png", "atas")
kartu([("PERESMIAN TAMAN NEGARA MERDU", 34, True), ("Blok 1879 · Usulan @hana_kaemung", 29, True),
       ("Air mancur · Gazebo · Ayunan · Perosotan", 28, False)], "o2_taman.png", "bawah")
kartu([("PERESMIAN TOKO PANCING", 36, True), ("Owner: @drennvanzz_ · Blok 1882", 29, True),
       ("Pemenang voting — ada kolam pancingnya", 28, False)], "o3_toko.png", "bawah")
kartu([("DI KOTA LAIN, WARGA CUMA DITONTON", 31, True), ("Di sini, kamu yang masuk.", 34, True)], "o4_masuk.png", "bawah")
kartu([("ABSEN WARGA BARU", 38, True), ("Blok 1881 terus terisi", 28, False)], "o5_absen_judul.png", "atas")
kartu([("@koala4011937 · Rumah No. 33", 30, True), ("@salsalsa759 · Rumah No. 34", 30, True)], "o6_absen.png", "bawah")
kartu([("LAPORAN KAS NEGARA", 38, True), ("Like terkumpul: 77 × Rp10.000", 32, True),
       ("Kas sekarang: Rp770.000", 34, True), ("Target berikutnya: Lapangan Rp8.000.000", 29, False),
       ("Usulan berjalan: Kopdes (Aldi Saputra)", 29, False)], "o7_kas.png", "bawah")
kartu([("MENUJU 100 WARGA", 40, True), ("Akan ada PERAYAAN 100 WARGA", 33, True),
       ("Yang follow bukan penonton — tapi warga.", 30, True),
       ("Daftar di merdu.id", 30, False),
       ("Pemilu dibuka di 10.000 warga", 28, False)], "o8_penutup.png", "tengah")
print("selesai")
