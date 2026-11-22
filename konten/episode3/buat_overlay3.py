#!/usr/bin/env python3
"""Buat PNG overlay teks Episode 3 Negara Merdu (720x1280, transparan) untuk ffmpeg.
Data live 22 Nov 2026: 32 warga (absen baru #19-#32), kas 62 like = Rp620.000,
voting Ep2: toko pancing 1 like, taman bermain 0, kopdes 0."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.expanduser("~/workspace/pinarak/konten/episode3/overlay")
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


kartu([("EPISODE 3", 40, True), ("NEGARA MERDU — 32 WARGA", 37, True)], "o1_judul.png", "atas")
kartu([("Pak Presiden menyapa warga baru", 34, True)], "o2_sapa.png", "bawah")
kartu([("ABSEN WARGA BARU", 38, True), ("Blok 1880 penuh — Blok 1881 mulai terisi", 28, False)], "o3_absen_judul.png", "atas")
kartu([("@0x646a6_00 · Rumah No. 19", 30, True), ("@ic4a_67 · Rumah No. 20", 30, True),
       ("@fana_2125 · Rumah No. 21", 30, True), ("@ssyauu · Rumah No. 22", 30, True)], "o4_absen_a.png", "bawah")
kartu([("@khrlarfan14 · Rumah No. 23", 30, True), ("@pokemon27771 · Rumah No. 24", 30, True),
       ("@syaurahafiqahtambunan · Rumah No. 25", 30, True), ("Blok 1880 resmi penuh!", 28, False)], "o5_absen_b.png", "bawah")
kartu([("@dsyaryn_ · Rumah No. 26", 30, True), ("@nathaniel_jayendraa · Rumah No. 27", 30, True),
       ("@the00nlyysyaa · Rumah No. 28", 30, True), ("@teukuryansf · Rumah No. 29", 30, True)], "o6_absen_c.png", "bawah")
kartu([("@deby.ra14 · Rumah No. 30", 30, True), ("@ratudhfta · Rumah No. 31", 30, True),
       ("@airaazzahra.putri · Rumah No. 32", 30, True)], "o7_absen_d.png", "bawah")
kartu([("LAPORAN KAS NEGARA", 38, True), ("Like terkumpul: 62 × Rp10.000", 32, True),
       ("Kas sekarang: Rp620.000", 34, True), ("Target Taman: Rp5.000.000", 30, False),
       ("Masih kurang: Rp4.380.000", 30, False)], "o8_kas.png", "bawah")
kartu([("VOTING BANGUNAN PERTAMA", 36, True), ("Toko pancing (@drennvanzz_) · 1 like", 29, True),
       ("SEMENTARA MEMIMPIN", 30, True),
       ("Taman bermain (@hana_kaemung) · 0 like", 29, True),
       ("Kopdes (Aldi Saputra) · 0 like", 29, True)], "o9_voting.png", "bawah")
kartu([("MAU BANGUN APA?", 40, True), ("Like usulan favoritmu,", 32, True),
       ("atau tulis usulanmu di komentar", 32, True)], "o10_bangun.png", "bawah")
kartu([("Follow @negaramerdu", 40, True), ("Daftar di merdu.id", 36, True),
       ("Dapat rumah, KTP & Kartu Keluarga", 30, False),
       ("Pemilu dibuka di 10.000 warga", 30, False)], "o11_penutup.png", "tengah")
print("selesai")
