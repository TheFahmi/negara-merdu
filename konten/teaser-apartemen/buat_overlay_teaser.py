#!/usr/bin/env python3
"""Overlay Teaser Apartemen Negara Merdu (720x1280).
Gaya kartu episode/drama: panel gelap rounded, nama penutur berwarna,
teks putih. Tanpa emoji."""
from PIL import Image, ImageDraw, ImageFont
import os, textwrap

OUT = os.path.expanduser("~/workspace/pinarak/konten/teaser-apartemen/overlay")
os.makedirs(OUT, exist_ok=True)
W, H = 720, 1280
BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
EMAS = (255, 205, 110)
PUTIH = (255, 255, 255)
MERAH = (255, 120, 120)


def teks_c(draw, cx, y, s, font, fill=PUTIH):
    bb = draw.textbbox((0, 0), s, font=font)
    draw.text((cx - (bb[2] - bb[0]) / 2 - bb[0], y), s, font=font, fill=fill)
    return bb[3] - bb[1]


def kartu(lines, nama, posisi="bawah"):
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


kartu([("TEASER NEGARA MERDU", 40, True, PUTIH),
       ("Proyek Terbesar Negara Ini", 34, True, EMAS)], "o1_judul.png", "atas")
dialog("NARATOR", EMAS,
       "Negara Merdu tidak berhenti membangun. Sesudah taman, toko pancing, dan masjid, Pak Presiden menyiapkan proyek terbesar dalam sejarah negara ini.",
       "o2_nar1.png")
dialog("PAK PRESIDEN", EMAS,
       "Di Blok 2120 ini, akan berdiri Apartemen Merdu Residence.",
       "o3_pres1.png")
dialog("PAK PRESIDEN", EMAS,
       "Sepuluh lantai, lift kaca panorama, dan kolam renang di atapnya. Warga Negara Merdu nanti tidak cuma punya rumah. Mereka juga bisa tinggal di apartemen.",
       "o4_pres2.png")
kartu([("VISUALISASI RENCANA", 34, True, EMAS),
       ("Beginilah wujudnya nanti", 28, False, PUTIH)], "o5_viz.png", "atas")
dialog("NARATOR", EMAS,
       "Beginilah wujudnya nanti. Harganya Rp50.000.000. Kas negara kita baru terkumpul Rp1.820.000.",
       "o6_nar2.png")
kartu([("TARGET APARTEMEN", 30, True, EMAS),
       ("Rp50.000.000", 44, True, PUTIH),
       ("Terkumpul Rp1.820.000", 30, False, PUTIH),
       ("Kurang Rp48.180.000", 30, True, MERAH),
       ("1 like = Rp10.000 · 1 share = Rp1.000.000", 26, False, PUTIH)], "o7_kas.png", "bawah")
kartu([("SEGERA", 34, True, EMAS),
       ("APARTEMEN MERDU RESIDENCE", 37, True, PUTIH),
       ("Blok 2120 · Rp50.000.000", 30, False, PUTIH),
       ("Yang follow bukan penonton — tapi warga.", 29, True, EMAS),
       ("Daftar di merdu.id", 28, False, PUTIH)], "o8_penutup.png", "tengah")
print("selesai")
