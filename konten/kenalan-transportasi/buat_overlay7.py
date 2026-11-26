#!/usr/bin/env python3
"""Overlay teks + kartu info Kenalan Transportasi Negara Merdu (720x1280 transparan).
Fakta live 24 Nov 2026: Bus Trans Merdu 9 bus, Koridor 1 + Koridor 2 (Plaza & Istana);
KRL Merdu 4 rangkaian, 2 stasiun (Stasiun Merdu & Stasiun Merdu Utara)."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.expanduser("~/workspace/pinarak/konten/kenalan-transportasi/overlay")
os.makedirs(OUT, exist_ok=True)
W, H = 720, 1280
BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
HIJAU = (46, 93, 67, 255)
EMAS = (217, 164, 65, 255)
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


# Judul pembuka (gaya kartu episode: panel gelap di atas)
kartu([("KENALAN TRANSPORTASI", 43, True), ("Bus Trans Merdu & KRL Merdu", 32, True)], "o1_judul.png", "atas")
label("BUS TRANS MERDU", "o_lab_bus.png")
label("DI DALAM BUS", "o_lab_dalambus.png")
label("PATUH LAMPU LALU LINTAS", "o_lab_lampu.png")
label("KRL MERDU — STASIUN MERDU", "o_lab_krl.png")
label("DI DALAM KRL", "o_lab_dalamkrl.png")
label("STASIUN MERDU UTARA", "o_lab_utara.png")
kartu([("YANG FOLLOW BUKAN PENONTON", 34, True), ("TAPI WARGA.", 34, True),
       ("Daftar di merdu.id", 30, False)], "o7_penutup.png", "tengah")

# ---------- Kartu info: peta rute skematik + cara naik ----------
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
PX0, PY0, PX1, PY1 = 26, 196, 694, 1084
d.rounded_rectangle([PX0, PY0, PX1, PY1], radius=26, fill=(46, 93, 67, 242))
d.rounded_rectangle([PX0, PY0, PX1, PY1], radius=26, outline=EMAS, width=4)
f_judul = ImageFont.truetype(BOLD, 36)
f_sub = ImageFont.truetype(BOLD, 24)
f_kcl = ImageFont.truetype(REG, 22)
f_leg = ImageFont.truetype(BOLD, 23)
teks(d, W // 2, PY0 + 24, "PETA RUTE & CARA NAIK", f_judul)
# skematik: loop KRL (luar)
KX0, KY0, KX1, KY1 = 92, 300, 628, 618
d.rounded_rectangle([KX0, KY0, KX1, KY1], radius=30, outline=(200, 215, 235, 255), width=7)
# panah arah di sisi kiri/kanan loop
d.polygon([(KX0 - 2, 430), (KX0 - 16, 452), (KX0 + 12, 452)], fill=(200, 215, 235, 255))
d.polygon([(KX1 + 2, 488), (KX1 + 16, 466), (KX1 - 12, 466)], fill=(200, 215, 235, 255))
# stasiun: Merdu di sisi bawah (tengah), Utara di sisi atas (kiri-tengah)
for (sx, sy) in [(360, KY1), (252, KY0)]:
    d.ellipse([sx - 11, sy - 11, sx + 11, sy + 11], fill=(255, 255, 255, 255), outline=EMAS, width=3)
teks(d, 360, KY1 + 14, "Stasiun Merdu", f_sub)
teks(d, 252, KY0 - 34, "Stasiun Merdu Utara", f_sub)
# Koridor 1: persegi dalam (kuning-hijau)
BX0, BY0, BX1, BY1 = 196, 386, 524, 552
d.rounded_rectangle([BX0, BY0, BX1, BY1], radius=18, outline=(139, 195, 74, 255), width=6)
for (hx, hy) in [(196, 470), (524, 470), (300, 386), (420, 386), (300, 552), (420, 552)]:
    d.ellipse([hx - 6, hy - 6, hx + 6, hy + 6], fill=(139, 195, 74, 255))
# Koridor 2: garis melintang lewat Plaza & Istana (oranye)
d.line([128, 486, 592, 486], fill=(255, 152, 0, 255), width=6)
for hx in (300, 360, 428):
    d.ellipse([hx - 6, 486 - 6, hx + 6, 486 + 6], fill=(255, 152, 0, 255))
teks(d, 360, 500, "Plaza", f_kcl)
teks(d, 452, 500, "Istana", f_kcl)
# legenda
ly = 668
for warna, s in [((200, 215, 235, 255), "KRL Merdu — rel layang, 2 stasiun"),
                 ((139, 195, 74, 255), "Bus Koridor 1 — keliling kota"),
                 ((255, 152, 0, 255), "Bus Koridor 2 — Plaza & Istana")]:
    d.line([92, ly + 12, 140, ly + 12], fill=warna, width=7)
    d.text((156, ly), s, font=f_leg, fill=(255, 255, 255))
    ly += 40
d.line([PX0 + 34, ly + 6, PX1 - 34, ly + 6], fill=EMAS, width=3)
ly += 28
teks(d, W // 2, ly, "CARA NAIK", f_judul)
ly += 58
for s in ["Datang ke halte atau stasiun,",
          "tunggu kendaraan berhenti,",
          "lalu tekan tombol Naik.",
          "Turun saat kendaraan berhenti lagi."]:
    teks(d, W // 2, ly, s, f_leg)
    ly += 36
img.save(os.path.join(OUT, "o_info.png"))
print("overlay: o_info.png")
print("selesai")
