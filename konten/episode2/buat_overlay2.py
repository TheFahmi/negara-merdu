#!/usr/bin/env python3
"""Buat PNG overlay teks Episode 2 Desa Pinarak (720x1280, transparan) untuk ffmpeg.
Angka kas dari data live IG 21 Nov 2026: teaser 1 like + Episode 1 42 like = 43 like.
Warga: 15 total, warga baru #2-#15 (verifikasi /api/warga 21 Nov 2026)."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.expanduser("~/workspace/pinarak/konten/episode2/overlay")
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


kartu([("EPISODE 2", 40, True), ("NEGARA MERDU — 18 WARGA", 37, True)], "o1_judul.png", "atas")
kartu([("Pak Presiden menyapa warga baru", 34, True)], "o2_sapa.png", "bawah")
kartu([("ABSEN WARGA BARU", 38, True), ("cari namamu di video!", 30, False)], "o3_absen_judul.png", "atas")
kartu([("@taa_lge12 · Rumah No. 2", 30, True), ("@zamourraa · Rumah No. 3", 30, True),
       ("@hana_kaemung · Rumah No. 4", 30, True), ("@drennvanzz_ · Rumah No. 5", 30, True)], "o4_absen_a.png", "bawah")
kartu([("@4caa_caaaee · Rumah No. 6", 30, True), ("@dwiaprianti30_ · Rumah No. 7", 30, True),
       ("@ulandesheeran_ · Rumah No. 8", 30, True), ("@4yumbukanayam · Rumah No. 9", 30, True)], "o5_absen_b.png", "bawah")
kartu([("@muhamad_aria_12 · Rumah No. 10", 30, True), ("@cil_aaaa38 · Rumah No. 11", 30, True),
       ("@kinannm_ · Rumah No. 12", 30, True), ("@azza.tyr · Rumah No. 13", 30, True)], "o6_absen_c.png", "bawah")
kartu([("@zamouraa · Rumah No. 14", 30, True), ("@drrennvanzz · Rumah No. 15", 30, True),
       ("@tati19384 · Rumah No. 16", 30, True)], "o7_absen_d.png", "bawah")
kartu([("@yiinu___ · Rumah No. 17", 30, True), ("@yogiibandheloo · Rumah No. 18", 30, True)], "o11_absen_e.png", "bawah")
kartu([("LAPORAN KAS NEGARA", 38, True), ("Like terkumpul: 44 × Rp10.000", 32, True),
       ("Kas sekarang: Rp440.000", 34, True), ("Target Taman: Rp5.000.000", 30, False),
       ("Masih kurang: Rp4.560.000", 30, False)], "o8_kas.png", "bawah")
kartu([("MAU BANGUN APA?", 40, True), ("Komen usulanmu — like terbanyak", 32, True),
       ("dibangun duluan, kamu jadi owner-nya", 32, True)], "o9_bangun.png", "bawah")
kartu([("Follow @negaramerdu", 40, True), ("Daftar di merdu.id", 36, True),
       ("Dapat rumah, KTP & Kartu Keluarga", 30, False),
       ("Pemilu dibuka di 10.000 warga", 30, False)], "o10_penutup.png", "tengah")
print("selesai")
