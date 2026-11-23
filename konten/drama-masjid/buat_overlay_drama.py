#!/usr/bin/env python3
"""Overlay dialog Drama Negara Merdu — Peresmian Masjid Baru (720x1280).
Gaya kartu episode: panel gelap rounded, nama penutur berwarna, teks dialog putih.
Tanpa emoji; ikon tidak dipakai di kartu teks."""
from PIL import Image, ImageDraw, ImageFont
import os, textwrap

OUT = os.path.expanduser("~/workspace/pinarak/konten/drama-masjid/overlay")
os.makedirs(OUT, exist_ok=True)
W, H = 720, 1280
BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
EMAS = (255, 205, 110)
BIRU = (150, 210, 255)
PUTIH = (255, 255, 255)


def teks_c(draw, cx, y, s, font, fill=PUTIH):
    bb = draw.textbbox((0, 0), s, font=font)
    draw.text((cx - (bb[2] - bb[0]) / 2 - bb[0], y), s, font=font, fill=fill)
    return bb[3] - bb[1]


def kartu(lines, nama, posisi="bawah"):
    """lines: list of (teks, ukuran, bold, warna)."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fonts = []
    total_h = 0
    for s, uk, b, wrn in lines:
        f = ImageFont.truetype(BOLD if b else REG, uk)
        fonts.append((s, f, wrn))
        total_h += uk + 13
    total_h -= 13
    pad = 26
    box_w = max(d.textbbox((0, 0), s, font=f)[2] for s, f, _ in fonts) + pad * 2
    box_h = total_h + pad * 2
    if posisi == "atas":
        y0 = 84
    elif posisi == "tengah":
        y0 = (H - box_h) // 2
    else:
        y0 = H - box_h - 150
    x0 = (W - box_w) // 2
    d.rounded_rectangle([x0, y0, x0 + box_w, y0 + box_h], radius=22, fill=(10, 10, 10, 150))
    y = y0 + pad
    for s, f, wrn in fonts:
        teks_c(d, W // 2, y, s, f, wrn)
        y += f.size + 13
    img.save(os.path.join(OUT, nama))
    print("overlay:", nama)


def dialog(penutur, warna, isi, nama):
    lines = [(penutur, 30, True, warna)]
    for ln in textwrap.wrap(isi, width=34):
        lines.append((ln, 29, False, PUTIH))
    kartu(lines, nama, "bawah")


kartu([("DRAMA NEGARA MERDU", 40, True, PUTIH),
       ("Peresmian Masjid Baru", 34, True, EMAS)], "o1_judul.png", "atas")
dialog("NARATOR", EMAS,
       "Pagi ini ada yang baru di Negara Merdu. Di Blok 2285, sebuah masjid berdiri megah. Kemarin, tempat ini masih lahan kosong.",
       "o2_nar1.png")
dialog("@hana_kaemung", BIRU,
       "Lho, kemarin aku lewat sini masih kosong. Kok sekarang sudah ada masjid?",
       "o3_hana.png")
dialog("@drennvanzz_", BIRU,
       "Jangan-jangan... kas negara kita habis buat bangun ini?",
       "o4_dren1.png")
dialog("@taa_lge12", BIRU,
       "Menaranya tinggi sekali. Ini beneran untuk kita semua?",
       "o5_taa.png")
dialog("PAK PRESIDEN", EMAS,
       "Betul, masjid ini untuk semua warga. Dan tenang: masjid ini dibangun tanpa memotong kas negara sepeser pun. Kas kita masih utuh, Rp770.000.",
       "o6_pres1.png")
dialog("PAK PRESIDEN", EMAS,
       "Ini hadiah untuk warga Negara Merdu. Tugas kita sekarang: menjaganya bersama-sama.",
       "o7_pres2.png")
dialog("@drennvanzz_", BIRU,
       "Wah... terima kasih, Pak Presiden!",
       "o8_dren2.png")
dialog("NARATOR", EMAS,
       "Masjid Negara Merdu resmi dibuka — fasilitas ketiga yang berdiri, sesudah Taman dan Toko Pancing. Berikutnya: apartemen di Blok 2120.",
       "o9_nar2.png")
kartu([("MASJID NEGARA MERDU", 38, True, PUTIH),
       ("RESMI DIBUKA", 38, True, PUTIH),
       ("Yang follow bukan penonton — tapi warga.", 29, True, EMAS),
       ("Daftar di merdu.id", 28, False, PUTIH)], "o10_penutup.png", "tengah")
print("selesai")
