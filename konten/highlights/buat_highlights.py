#!/usr/bin/env python3
"""Buat aset Story Highlights @negaramerdu: 7 story 1080x1920 + 3 sampul 1080x1080.
Gaya mengikuti overlay Episode 1: Noto Sans, kartu gelap membulat di atas foto,
krem + emas golden-hour di atas latar polos. Tanpa emoji; ikon digambar sendiri.
"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE = os.path.expanduser("~/workspace/pinarak/konten/highlights")
os.makedirs(BASE, exist_ok=True)
WS = os.path.expanduser("~/workspace")
BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"

W, H = 1080, 1920
KREM = (247, 238, 220)
KREM_GELAP = (238, 224, 196)
COKLAT = (43, 32, 22)
COKLAT2 = (92, 66, 40)
EMAS = (186, 138, 44)
EMAS_TERANG = (216, 170, 74)
HIJAU = (110, 148, 78)
TERAKOTA = (178, 84, 52)
PUTIH = (255, 255, 255)
KARTU = (12, 10, 8, 158)


def F(uk, bold=True):
    return ImageFont.truetype(BOLD if bold else REG, uk)


def teks_tengah(d, cx, y, s, font, fill):
    b = d.textbbox((0, 0), s, font=font)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], y), s, font=font, fill=fill)
    return b[3] - b[1]


def bungkus(d, s, font, lebar):
    kata, baris, cur = s.split(), [], ""
    for k in kata:
        coba = (cur + " " + k).strip()
        if d.textbbox((0, 0), coba, font=font)[2] <= lebar:
            cur = coba
        else:
            baris.append(cur)
            cur = k
    if cur:
        baris.append(cur)
    return baris


def cover_crop(img, tw, th, fy=0.5):
    """Skala gambar menutupi kotak tw x th lalu crop. fy = titik fokus vertikal 0..1."""
    iw, ih = img.size
    skala = max(tw / iw, th / ih)
    img2 = img.resize((round(iw * skala), round(ih * skala)), Image.LANCZOS)
    x = (img2.width - tw) // 2
    y = int((img2.height - th) * fy)
    return img2.crop((x, y, x + tw, y + th))


def kartu_gelap(img, lines, y0):
    """Kartu gelap membulat ala overlay Episode 1. lines: (teks, ukuran, bold, warna)."""
    d = ImageDraw.Draw(img, "RGBA")
    fonts = [(s, F(u, b), w) for s, u, b, w in lines]
    pad_x, pad_y, jarak = 44, 34, 16
    lebar = max(d.textbbox((0, 0), s, font=f)[2] for s, f, _ in fonts) + pad_x * 2
    tinggi = sum(f.size for _, f, _ in fonts) + jarak * (len(fonts) - 1) + pad_y * 2
    x0 = (W - lebar) // 2
    d.rounded_rectangle([x0, y0, x0 + lebar, y0 + tinggi], radius=30, fill=KARTU)
    y = y0 + pad_y
    for s, f, w in fonts:
        teks_tengah(d, W // 2, y, s, f, w)
        y += f.size + jarak
    return y0 + tinggi


def merek_atas(img, gelap=False):
    d = ImageDraw.Draw(img, "RGBA")
    f = F(40)
    s = "NEGARA MERDU"
    b = d.textbbox((0, 0), s, font=f)
    w = b[2] - b[0] + 56
    fill = KARTU if not gelap else (255, 255, 255, 235)
    warna = PUTIH if not gelap else COKLAT
    d.rounded_rectangle([(W - w) // 2, 108, (W + w) // 2, 108 + 78], radius=39, fill=fill)
    teks_tengah(d, W // 2, 108 + 16, s, f, warna)


def kaki(img, gelap=False):
    d = ImageDraw.Draw(img)
    teks_tengah(d, W // 2, H - 128, "@negaramerdu  ·  merdu.id", F(38, False),
                PUTIH if gelap else COKLAT2)


# ---------- IKON (digambar sendiri) ----------
def ikon_formulir(d, cx, cy, skala=1.0, warna=PUTIH, aksen=(43, 32, 22)):
    """Lembar formulir + pensil."""
    w, h = 300 * skala, 400 * skala
    x0, y0 = cx - w / 2, cy - h / 2
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=26 * skala, fill=warna)
    for i in range(3):
        ly = y0 + (110 + i * 78) * skala
        d.rounded_rectangle([x0 + 48 * skala, ly, x0 + w - 48 * skala, ly + 30 * skala],
                            radius=15 * skala, fill=(206, 196, 178))
    # pensil diagonal
    px, py = cx + 92 * skala, cy + 40 * skala
    d.polygon([(px, py + 150 * skala), (px + 42 * skala, py + 162 * skala),
               (px + 168 * skala, py - 62 * skala), (px + 126 * skala, py - 74 * skala)],
              fill=EMAS_TERANG)
    d.polygon([(px, py + 150 * skala), (px + 42 * skala, py + 162 * skala),
               (px + 14 * skala, py + 116 * skala)], fill=aksen)


def ikon_putar(d, cx, cy, skala=1.0, warna=PUTIH):
    r = 215 * skala
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=warna, width=int(34 * skala))
    d.polygon([(cx - 62 * skala, cy - 105 * skala), (cx - 62 * skala, cy + 105 * skala),
               (cx + 118 * skala, cy)], fill=warna)


def ikon_kantong(d, cx, cy, skala=1.0, warna=PUTIH, aksen=(122, 84, 20)):
    # simpul ikatan kecil di atas
    d.polygon([(cx - 58 * skala, cy - 205 * skala), (cx - 10 * skala, cy - 205 * skala),
               (cx - 24 * skala, cy - 128 * skala), (cx - 62 * skala, cy - 140 * skala)], fill=warna)
    d.polygon([(cx + 58 * skala, cy - 205 * skala), (cx + 10 * skala, cy - 205 * skala),
               (cx + 24 * skala, cy - 128 * skala), (cx + 62 * skala, cy - 140 * skala)], fill=warna)
    d.rounded_rectangle([cx - 88 * skala, cy - 152 * skala, cx + 88 * skala, cy - 100 * skala],
                        radius=22 * skala, fill=warna)
    # badan kantong: trapesium leher menyatu ke elips bulat (tanpa bahu patah)
    d.polygon([(cx - 80 * skala, cy - 105 * skala), (cx + 80 * skala, cy - 105 * skala),
               (cx + 205 * skala, cy + 70 * skala), (cx - 205 * skala, cy + 70 * skala)], fill=warna)
    d.ellipse([cx - 218 * skala, cy - 60 * skala, cx + 218 * skala, cy + 290 * skala], fill=warna)
    f = F(int(120 * skala))
    b = d.textbbox((0, 0), "Rp", font=f)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - 6 * skala - b[1]), "Rp", font=f, fill=aksen)


def ikon_koin(d, cx, cy, skala=1.0):
    r = 120 * skala
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=EMAS_TERANG, outline=(150, 106, 28),
              width=int(10 * skala))
    r2 = 88 * skala
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=(150, 106, 28), width=int(7 * skala))
    f = F(int(84 * skala))
    b = d.textbbox((0, 0), "Rp", font=f)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - (b[3] - b[1]) / 2 - b[1]), "Rp", font=f,
           fill=(122, 84, 20))


# ---------- STORY ----------
def latar_krem():
    img = Image.new("RGB", (W, H), KREM)
    d = ImageDraw.Draw(img)
    d.rectangle([0, H - 26], fill=EMAS_TERANG) if False else None
    d.rectangle([0, H - 30, W, H], fill=EMAS_TERANG)
    d.rectangle([0, 0, W, 30], fill=EMAS_TERANG)
    return img


def s_daftar_1():
    img = latar_krem()
    foto = Image.open(f"{WS}/wsdiag/bukti-blok1/satublok_1880.jpg").convert("RGB")
    img.paste(cover_crop(foto, W, 980, fy=0.35), (0, 0))
    d = ImageDraw.Draw(img)
    merek_atas(img)
    ikon_formulir(d, W // 2, 1130, skala=0.62, warna=COKLAT, aksen=KREM)
    teks_tengah(d, W // 2, 1300, "CARA DAFTAR", F(104), COKLAT)
    teks_tengah(d, W // 2, 1440, "Jadi Warga Negara Merdu", F(56, False), COKLAT2)
    teks_tengah(d, W // 2, 1560, "Gratis — cukup follow & daftar", F(44, False), COKLAT2)
    kaki(img)
    img.save(f"{BASE}/daftar_1_judul.png")
    print("daftar_1_judul.png")


def s_daftar_2():
    img = latar_krem()
    d = ImageDraw.Draw(img)
    merek_atas(img, gelap=True)
    teks_tengah(d, W // 2, 250, "4 Langkah Mudah", F(72), COKLAT)
    langkah = [
        ("Follow @negaramerdu", ""),
        ("Buka merdu.id", "di browser HP kamu"),
        ("Daftar pakai username IG-mu", "lalu buat PIN 6 digit"),
        ("Pilih warna baju & topi", "karaktermu langsung jadi"),
    ]
    y = 420
    for i, (utama, sub) in enumerate(langkah, 1):
        d.ellipse([90, y, 190, y + 100], fill=EMAS)
        teks_tengah(d, 140, y + 18, str(i), F(62), PUTIH)
        d.text((230, y - 2), utama, font=F(52), fill=COKLAT)
        if sub:
            d.text((230, y + 62), sub, font=F(40, False), fill=COKLAT2)
        y += 168
    # Pita bawah: cluster rumah Blok 1880 (render karakter yang ada memuat papan
    # "Pak Kades" pra-rebrand, jadi tidak dipakai di sini).
    band = Image.open(f"{WS}/wsdiag/bukti-blok1/satublok_1880.jpg").convert("RGB")
    img.paste(cover_crop(band, W, 560, fy=0.45), (0, 1180))
    kaki(img)
    img.save(f"{BASE}/daftar_2_langkah.png")
    print("daftar_2_langkah.png")


def s_daftar_3():
    img = latar_krem()
    foto = Image.open(f"{WS}/wsdiag/bukti-blok1/interior_skill.jpg").convert("RGB")
    # Crop separuh kiri saja (lukisan + jam + kasur): papan nama/KK di kanan
    # masih bertuliskan merek lama pra-rebrand, jadi tidak ikut tampil.
    foto = foto.crop((0, 30, 660, 850))
    img.paste(cover_crop(foto, W, 860, fy=0.35), (0, 0))
    d = ImageDraw.Draw(img)
    merek_atas(img)
    teks_tengah(d, W // 2, 950, "Kamu Dapat:", F(66), COKLAT)
    y = 1075
    for s in ["Rumah sendiri di Blok 1880", "KTP Negara Merdu", "Kartu Keluarga"]:
        teks_tengah(d, W // 2, y, s, F(58), COKLAT)
        y += 92
    d.rounded_rectangle([140, 1420, W - 140, 1560], radius=28, fill=EMAS)
    teks_tengah(d, W // 2, 1458, "Pintu negara selalu terbuka", F(50), PUTIH)
    teks_tengah(d, W // 2, 1620, "Daftar sekarang di merdu.id", F(44, False), COKLAT2)
    kaki(img)
    img.save(f"{BASE}/daftar_3_hasil.png")
    print("daftar_3_hasil.png")


def s_episode_1():
    cover = Image.open(f"{WS}/pinarak/konten/episode1/cover.jpg").convert("RGB")
    img = cover.resize((W, H), Image.LANCZOS)
    kartu_gelap(img, [("EPISODE 1", 84, True, PUTIH),
                      ("NEGARA BARU BERDIRI", 58, True, PUTIH)], 150)
    kartu_gelap(img, [("Sudah tayang — tonton di feed", 52, True, PUTIH)], H - 330)
    img.save(f"{BASE}/episode_1.png")
    print("episode_1.png")


def s_episode_2():
    img = latar_krem()
    d = ImageDraw.Draw(img)
    merek_atas(img, gelap=True)
    ikon_putar(d, W // 2, 620, skala=1.15, warna=TERAKOTA)
    teks_tengah(d, W // 2, 950, "EPISODE 2", F(120), COKLAT)
    teks_tengah(d, W // 2, 1115, "SEDANG DIBUAT", F(64), TERAKOTA)
    y = 1260
    for s in bungkus(d, "Pak Presiden menyapa 14 warga baru dan menghitung Kas Negara.",
                     F(48, False), 860):
        teks_tengah(d, W // 2, y, s, F(48, False), COKLAT2)
        y += 66
    teks_tengah(d, W // 2, 1520, "Tunggu di feed @negaramerdu", F(44, False), COKLAT2)
    kaki(img)
    img.save(f"{BASE}/episode_2.png")
    print("episode_2.png")


def s_kas_1():
    img = latar_krem()
    d = ImageDraw.Draw(img)
    merek_atas(img, gelap=True)
    ikon_koin(d, W // 2, 400, skala=1.0)
    teks_tengah(d, W // 2, 590, "KAS NEGARA", F(96), COKLAT)
    teks_tengah(d, W // 2, 720, "Kas terisi dari interaksi kalian:", F(46, False), COKLAT2)
    baris = [
        ("Like postingan", "Rp10.000"),
        ("Share postingan", "Rp1.000.000"),
        ("Komentar", "usulan bangunan"),
    ]
    y = 880
    for kiri, kanan in baris:
        d.rounded_rectangle([80, y, W - 80, y + 150], radius=26, fill=(255, 252, 244))
        d.text((120, y + 42), kiri, font=F(52), fill=COKLAT)
        b = d.textbbox((0, 0), kanan, font=F(52))
        d.text((W - 120 - (b[2] - b[0]), y + 42), kanan, font=F(52), fill=EMAS)
        y += 190
    y += 20
    for s in bungkus(d, "Komentar tidak bernilai rupiah — komentar adalah usul "
                        "bangunan yang akan dibangun berikutnya.", F(42, False), 880):
        teks_tengah(d, W // 2, y, s, F(42, False), COKLAT2)
        y += 58
    kaki(img)
    img.save(f"{BASE}/kas_1_cara.png")
    print("kas_1_cara.png")


def s_kas_2():
    img = latar_krem()
    d = ImageDraw.Draw(img)
    merek_atas(img, gelap=True)
    ikon_kantong(d, W // 2, 470, skala=0.9, warna=EMAS_TERANG, aksen=(122, 84, 20))
    teks_tengah(d, W // 2, 800, "Saldo Kas Negara sekarang:", F(50, False), COKLAT2)
    teks_tengah(d, W // 2, 880, "Rp430.000", F(128), EMAS)
    # bilah kemajuan ke target Taman 5.000.000
    x0, x1, yb = 110, W - 110, 1120
    d.rounded_rectangle([x0, yb, x1, yb + 54], radius=27, fill=(224, 208, 172))
    lebar_isi = int((x1 - x0) * 430000 / 5000000)
    d.rounded_rectangle([x0, yb, x0 + max(lebar_isi, 54), yb + 54], radius=27, fill=EMAS)
    teks_tengah(d, W // 2, 1210, "Target pertama: Taman Rp5.000.000", F(50), COKLAT)
    teks_tengah(d, W // 2, 1290, "Masih kurang Rp4.570.000", F(50), TERAKOTA)
    y = 1440
    for s in bungkus(d, "Setiap like menambah Rp10.000 dan setiap share Rp1.000.000 "
                        "ke kas. Ramaikan postingan Episode 1!", F(44, False), 880):
        teks_tengah(d, W // 2, y, s, F(44, False), COKLAT2)
        y += 60
    kaki(img)
    img.save(f"{BASE}/kas_2_saldo.png")
    print("kas_2_saldo.png")


# ---------- SAMPUL ----------
def sampul(nama, warna_bg, gambar_ikon):
    img = Image.new("RGB", (1080, 1080), warna_bg)
    d = ImageDraw.Draw(img)
    gambar_ikon(d, 540, 540)
    img.save(f"{BASE}/{nama}")
    print(nama)


s_daftar_1()
s_daftar_2()
s_daftar_3()
s_episode_1()
s_episode_2()
s_kas_1()
s_kas_2()
sampul("sampul_daftar.png", HIJAU, lambda d, x, y: ikon_formulir(d, x, y, skala=1.25))
sampul("sampul_episode.png", TERAKOTA, lambda d, x, y: ikon_putar(d, x, y, skala=1.25))
sampul("sampul_kas.png", (222, 178, 84), lambda d, x, y: ikon_kantong(d, x, y, skala=1.15))
print("SELESAI")
