#!/usr/bin/env python3
"""Desa Pinarak — server v2 (skala target 100.000 warga).
Backend: Python stdlib (http.server) + PostgreSQL via psycopg 3.
PIN warga disimpan sebagai hash PBKDF2-HMAC-SHA256 + salt per warga.

Skala:
- username UNIQUE (terindeks), nomor_rumah UNIQUE (terindeks).
- /api/warga WAJIB pagination (limit/offset) + urut terlama/terbaru.
- Statistik dari COUNT(*) terindeks.
- Alokasi kavling berurutan dalam grid persegi kota:
  25 kavling per blok (5x5), 80 kolom blok x 50 baris blok = 4.000 blok
  = 100.000 kavling.
"""
import base64
import hashlib
import hmac
import json
import os
import random
import re
import secrets
import socket
import psycopg
from psycopg.rows import dict_row
import struct
import threading
import time
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(BASE, "public")
# Database PostgreSQL (migrasi dari SQLite, 20 Nov 2026): koneksi dari ENV
# DATABASE_URL. Nilai bawaan di bawah HANYA untuk pengembangan lokal;
# produksi diisi lewat environment (lihat .env.example & docker-compose.yml).
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://pinarak:pinarak@localhost:5432/pinarak"
)
PORT = int(os.environ.get("PORT", "8026"))
HOST = os.environ.get("HOST", "0.0.0.0")

KAPASITAS = 100_000
PER_BLOK = 25
BLOK_KOLOM = 80
BLOK_BARIS = 50

# Satuan dunia (samakan dengan klien): pitch blok 84 -> kota 6.720 x 4.200.
# Posisi chat/pemain divalidasi server dengan clamp ke batas kota + margin drone.
PITCH_SATUAN = 84
KOTA_W = BLOK_KOLOM * PITCH_SATUAN
KOTA_D = BLOK_BARIS * PITCH_SATUAN
BATAS_X = KOTA_W / 2 + 500
BATAS_Z = KOTA_D / 2 + 500

CHAT_MAKS = 200          # karakter per pesan
CHAT_JEDA = 1.5          # detik antar pesan per warga
CHAT_RIWAYAT = 50        # pesan terakhir yang dimuat ke klien baru

KELUARGA_MAKS = 5        # warga per keluarga (Kartu Keluarga)
# Peran di keluarga HANYA dua (keputusan Fahmi): pendiri = Kepala Keluarga,
# semua yang bergabung sesudahnya = Anggota. Tidak ada peran lain.
PERAN_LABEL = {"kepala": "Kepala Keluarga", "anggota": "Anggota"}
_rng = random.SystemRandom()  # pengacakan server untuk pengelompokan keluarga

# ================= PEMILU (Ketua RT / RW / Kepala Desa) =================
# Token admin (Pak Kades) dibaca dari ENV PINARAK_ADMIN_TOKEN; tanpa env
# yang cocok, semua endpoint admin pemilu menolak (403). Nilai token TIDAK
# pernah ditulis ke kode/log/laporan.
ADMIN_TOKEN = os.environ.get("PINARAK_ADMIN_TOKEN") or ""
VISI_MAKS = 200            # karakter visi kandidat
MISI_MAKS = 1000           # karakter misi kandidat
JABATAN_LABEL = {"kades": "Kepala Desa", "rw": "Ketua RW", "rt": "Ketua RT"}
# Gerbang jumlah warga (keputusan Fahmi 20 Nov 2026: "Pemilu harus ketika
# user udah 10rb"): periode pemilu hanya boleh DIBUKA bila warga terdaftar
# sudah mencapai ambang ini. ENV PINARAK_MIN_WARGA hanya untuk UJI lokal
# (menurunkan ambang di DB uji); produksi memakai bawaan 10.000.
try:
    PEMILU_MIN_WARGA = int(os.environ.get("PINARAK_MIN_WARGA") or "10000")
except ValueError:
    PEMILU_MIN_WARGA = 10_000

# ================= PEMBANGUNAN BERTAHAP (fasilitas desa) =================
# Keputusan Fahmi 20 Nov 2026: "Desa awalnya cuma kantor kades. Nanti
# followers minta bangun ini itu." Desa mulai HANYA dengan kantor kades
# (balai desa di Distrik Pusat); fasilitas lain berdiri satu per satu dari
# usulan warga (komentar Instagram) yang diputuskan Pak Kades lewat
# endpoint admin. Blok lahannya dicadangkan dari 60 blok taman lama —
# kisi taman klien: kol 4+8a (a=0..9) x bar 4+8b (b=0..5); blok (1-based)
# = bar*80 + kol + 1. Peta kol/bar ini harus sama dengan FASILITAS_BLOK
# di public/app.js. Biaya = angka Kas Desa virtual gaya Ase Jaya; kasnya
# sendiri dicatat di ledger IG terpisah (~/workspace/pinarak/kas-desa/),
# BUKAN di server ini — server hanya menyimpan status bangunannya.
FASILITAS = [
    # Urutan tampil di panel: dari biaya termurah (paling awal dibangun).
    {"kunci": "taman",        "nama": "Taman Desa",        "biaya": 5_000_000,  "kol": 36, "bar": 20},   # Blok 1637
    {"kunci": "lapangan",     "nama": "Lapangan Bola",     "biaya": 8_000_000,  "kol": 20, "bar": 36},   # Blok 2901
    {"kunci": "perpustakaan", "nama": "Perpustakaan Desa", "biaya": 12_000_000, "kol": 12, "bar": 12},   # Blok 973
    {"kunci": "balai_warga",  "nama": "Balai Warga",       "biaya": 15_000_000, "kol": 68, "bar": 12},   # Blok 1029
    {"kunci": "sekolah",      "nama": "Sekolah Dasar",     "biaya": 20_000_000, "kol": 52, "bar": 20},   # Blok 1653
    {"kunci": "puskesmas",    "nama": "Puskesmas",         "biaya": 25_000_000, "kol": 60, "bar": 36},   # Blok 2941
    {"kunci": "pasar",        "nama": "Pasar Desa",        "biaya": 30_000_000, "kol": 28, "bar": 28},   # Blok 2269
    {"kunci": "masjid",       "nama": "Masjid",            "biaya": 40_000_000, "kol": 44, "bar": 28},   # Blok 2285
]
FASILITAS_PER_KUNCI = {f["kunci"]: f for f in FASILITAS}
# Wilayah suara memakai kolom `wilayah`: nomor RT (1..160) / nomor RW (1..20);
# 0 = seluruh desa (jabatan kades) — 0 (bukan NULL) supaya UNIQUE suara bekerja.


def wilayah_dari_blok(blok):
    """Nomor blok (1-based) -> (nomor RT, nomor RW). Deterministik, dihitung
    dari posisi blok di grid 80 kolom x 50 baris — TIDAK disimpan sebagai
    kolom, selalu dihitung dari `blok` warga:
    - RT = kelompok blok 5 kolom x 5 baris -> 16 x 10 = 160 RT (625 kavling).
    - RW = kelompok 4 kolom-RT x 2 baris-RT (= 20 x 10 blok) -> 4 x 5 = 20 RW
      (8 RT, 5.000 kavling)."""
    baris, kolom = divmod(int(blok) - 1, BLOK_KOLOM)
    rt_kol, rt_bar = kolom // 5, baris // 5
    rt = rt_bar * 16 + rt_kol + 1
    rw = (rt_bar // 2) * 4 + (rt_kol // 4) + 1
    return rt, rw


def label_jabatan(jabatan, wilayah):
    """Label tampil jabatan aktif, mis. 'Kepala Desa', 'Ketua RW 07', 'Ketua RT 042'."""
    if jabatan == "kades":
        return "Kepala Desa"
    if jabatan == "rw":
        return f"Ketua RW {int(wilayah):02d}"
    if jabatan == "rt":
        return f"Ketua RT {int(wilayah):03d}"
    return None


def peta_jabatan(conn):
    """{warga_id: label jabatan aktif} untuk semua pejabat — dipakai jalur
    daftar (pagination) supaya tidak query per baris."""
    return {
        r["warga_id"]: label_jabatan(r["jabatan"], r["wilayah"])
        for r in conn.execute("SELECT warga_id, jabatan, wilayah FROM jabatan")
    }


USERNAME_RE = re.compile(r"^[a-z0-9._]{1,30}$")
PIN_RE = re.compile(r"^\d{6}$")
WARNA_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
TOPI_SAH = {"peci", "topi", "tanpa"}

_db_lock = threading.Lock()

# Kunci advisory transaksi PostgreSQL untuk titik race alokasi nomor rumah
# (lihat daftar()): _db_lock menserialkan semua akses DB di dalam SATU
# proses ini; advisory lock menjaga invariant yang sama seandainya kelak
# ada lebih dari satu replika app berbagi satu database.
KUNCI_ALOKASI = 20261120


def alokasi(nomor: int):
    """Nomor urut warga (1-based) -> (blok 1-based, kavling 1-based, baris, kolom 0-based)."""
    idx = nomor - 1
    blok_idx, kavling_idx = divmod(idx, PER_BLOK)
    baris, kolom = divmod(blok_idx, BLOK_KOLOM)
    return blok_idx + 1, kavling_idx + 1, baris, kolom


def db():
    """Koneksi PostgreSQL baru; baris sebagai dict (setara sqlite3.Row).

    Selalu dipakai dalam pola `with db() as conn:` — psycopg meng-commit
    transaksi & menutup koneksi saat blok berakhir (rollback bila ada
    pengecualian), sama seperti pola konteks SQLite sebelumnya."""
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


KODE_DESA_NIK = "3201"  # awalan tetap NIK Pinarak (4 digit pertama)


def buat_nik(created_at, nomor_rumah):
    """NIK Pinarak, 16 digit: KODE_DESA_NIK (4) + YYMMDD tanggal daftar (6)
    + nomor rumah zero-padded (6, 000001..100000).
    nomor_rumah UNIQUE -> NIK dijamin unik walau tanggal sama. Deterministik
    dari (created_at, nomor_rumah) -> backfill idempoten secara konstruksi."""
    tgl = None
    if created_at:
        try:
            tgl = datetime.strptime(str(created_at)[:10], "%Y-%m-%d")
        except ValueError:
            tgl = None
    if tgl is None:
        tgl = datetime.utcnow()
    return KODE_DESA_NIK + tgl.strftime("%y%m%d") + f"{int(nomor_rumah):06d}"


def buat_no_kk(created_at, keluarga_id):
    """Nomor KK Pinarak, 16 digit — skema sama seperti NIK:
    KODE_DESA_NIK (4) + YYMMDD tanggal keluarga dibuat (6) + nomor urut
    keluarga (id, zero-padded 6). id keluarga unik -> No. KK unik.
    Deterministik dari (created_at, id) -> pembuatan ulang idempoten."""
    tgl = None
    if created_at:
        try:
            tgl = datetime.strptime(str(created_at)[:10], "%Y-%m-%d")
        except ValueError:
            tgl = None
    if tgl is None:
        tgl = datetime.utcnow()
    return KODE_DESA_NIK + tgl.strftime("%y%m%d") + f"{int(keluarga_id):06d}"


# ================= KELUARGA (pengelompokan acak + Kartu Keluarga) =================

def _keluarga_belum_penuh(conn):
    """Id semua keluarga yang anggotanya masih < KELUARGA_MAKS."""
    rows = conn.execute(
        """SELECT k.id AS id FROM keluarga k
           LEFT JOIN warga w ON w.keluarga_id = k.id
           GROUP BY k.id HAVING COUNT(w.id) < %s ORDER BY k.id""",
        (KELUARGA_MAKS,),
    ).fetchall()
    return [r["id"] for r in rows]


def pilih_keluarga_acak(conn):
    """Pilih SECARA ACAK (SystemRandom) satu keluarga yang belum penuh;
    None bila tidak ada keluarga yang muat."""
    calon = _keluarga_belum_penuh(conn)
    return _rng.choice(calon) if calon else None


def _buat_keluarga_baru(conn):
    """Buat baris keluarga baru + isi No. KK-nya; kembalikan id keluarga."""
    sekarang = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    kid = conn.execute(
        "INSERT INTO keluarga(no_kk, created_at) VALUES('', %s) RETURNING id",
        (sekarang,),
    ).fetchone()["id"]
    conn.execute(
        "UPDATE keluarga SET no_kk=%s WHERE id=%s",
        (buat_no_kk(sekarang, kid), kid),
    )
    return kid


def gabung_keluarga(conn, warga_id):
    """Masukkan warga ke keluarga: dipilih ACAK ke satu keluarga yang belum
    penuh sebagai Anggota; bila tidak ada yang muat, buat keluarga baru dan
    jadikan warga ini Kepala Keluarga-nya. Kembalikan (keluarga_id, peran)."""
    kid = pilih_keluarga_acak(conn)
    if kid is not None:
        peran = "anggota"
    else:
        kid = _buat_keluarga_baru(conn)
        peran = "kepala"
    conn.execute(
        "UPDATE warga SET keluarga_id=%s, peran=%s WHERE id=%s",
        (kid, peran, warga_id),
    )
    return kid, peran


def init_db():
    with db() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS warga(
                id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                pin_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                warna_baju TEXT NOT NULL,
                warna_kulit TEXT NOT NULL,
                topi TEXT NOT NULL,
                nomor_rumah INTEGER UNIQUE NOT NULL,
                blok INTEGER NOT NULL,
                kavling INTEGER NOT NULL,
                nik TEXT,
                keluarga_id BIGINT,
                peran TEXT,
                created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
            )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_warga_nomor ON warga(nomor_rumah)")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS keluarga(
                id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                no_kk TEXT UNIQUE NOT NULL,
                created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
            )"""
        )
        # Migrasi skema lama: kolom yang belum ada -> tambahkan (data lama
        # utuh). Pola PostgreSQL: ADD COLUMN IF NOT EXISTS, tanpa perlu
        # membaca information_schema lebih dulu.
        conn.execute("ALTER TABLE warga ADD COLUMN IF NOT EXISTS nik TEXT")
        conn.execute("ALTER TABLE warga ADD COLUMN IF NOT EXISTS keluarga_id BIGINT")
        conn.execute("ALTER TABLE warga ADD COLUMN IF NOT EXISTS peran TEXT")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_warga_keluarga ON warga(keluarga_id)")
        # Backfill NIK warga lama: hanya baris yang belum punya NIK, jadi
        # menjalankan ini berkali-kali tidak pernah mengubah NIK yang ada.
        for r in conn.execute(
            "SELECT id, created_at, nomor_rumah FROM warga WHERE nik IS NULL OR nik=''"
        ).fetchall():
            conn.execute(
                "UPDATE warga SET nik=%s WHERE id=%s",
                (buat_nik(r["created_at"], r["nomor_rumah"]), r["id"]),
            )
        try:
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_warga_nik ON warga(nik)")
        except psycopg.IntegrityError:
            print("PERINGATAN: indeks unik NIK tidak dibuat (NIK ganda?)", flush=True)
        # Backfill keluarga warga lama: yang belum berkeluarga digabungkan
        # dengan aturan yang sama seperti pendaftaran baru (acak, maks 5,
        # pendiri keluarga baru = Kepala Keluarga). Idempoten: sesudah semua
        # warga punya keluarga_id, menjalankan ini lagi tidak mengubah
        # keluarga yang sudah terbentuk.
        for r in conn.execute(
            "SELECT id FROM warga WHERE keluarga_id IS NULL ORDER BY nomor_rumah ASC"
        ).fetchall():
            gabung_keluarga(conn, r["id"])
        # Perbaikan peran parsial (migrasi terputus di tengah): keluarga tanpa
        # kepala -> anggota bernomor rumah terkecil dipromosikan; peran kosong
        # pada anggota lain diisi "anggota".
        for k in conn.execute("SELECT id FROM keluarga").fetchall():
            ada_kepala = conn.execute(
                "SELECT COUNT(*) c FROM warga WHERE keluarga_id=%s AND peran='kepala'",
                (k["id"],),
            ).fetchone()["c"]
            if not ada_kepala:
                pertama = conn.execute(
                    "SELECT id FROM warga WHERE keluarga_id=%s ORDER BY nomor_rumah ASC LIMIT 1",
                    (k["id"],),
                ).fetchone()
                if pertama:
                    conn.execute(
                        "UPDATE warga SET peran='kepala' WHERE id=%s", (pertama["id"],)
                    )
        conn.execute(
            "UPDATE warga SET peran='anggota' WHERE keluarga_id IS NOT NULL "
            "AND (peran IS NULL OR peran NOT IN ('kepala','anggota'))"
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS sesi(
                token TEXT PRIMARY KEY,
                warga_id INTEGER NOT NULL,
                created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS chat(
                id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                warga_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                isi TEXT NOT NULL,
                created_at TEXT NOT NULL,
                sistem INTEGER NOT NULL DEFAULT 0
            )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_id ON chat(id)")
        # Migrasi skema lama: kolom penanda pesan sistem (sambutan Pak Kades).
        conn.execute("ALTER TABLE chat ADD COLUMN IF NOT EXISTS sistem INTEGER NOT NULL DEFAULT 0")
        # ---- Pemilu: periode, kandidat, suara, jabatan aktif ----
        conn.execute(
            """CREATE TABLE IF NOT EXISTS pemilu(
                id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'pencalonan',
                dibuka_pada TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
                ditutup_pada TEXT
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS kandidat(
                id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                pemilu_id INTEGER NOT NULL,
                warga_id INTEGER NOT NULL,
                jabatan TEXT NOT NULL,
                wilayah INTEGER NOT NULL DEFAULT 0,
                visi TEXT NOT NULL,
                misi TEXT NOT NULL,
                dibuat_pada TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
                UNIQUE(pemilu_id, warga_id)
            )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_kandidat_pemilu ON kandidat(pemilu_id, jabatan, wilayah)")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS suara(
                id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                pemilu_id INTEGER NOT NULL,
                pemilih_id INTEGER NOT NULL,
                jabatan TEXT NOT NULL,
                wilayah INTEGER NOT NULL DEFAULT 0,
                kandidat_id INTEGER NOT NULL,
                dibuat_pada TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
                UNIQUE(pemilu_id, pemilih_id, jabatan, wilayah)
            )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_suara_kandidat ON suara(kandidat_id)")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS jabatan(
                warga_id BIGINT PRIMARY KEY,
                jabatan TEXT NOT NULL,
                wilayah INTEGER NOT NULL DEFAULT 0,
                sejak TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
                pemilu_id INTEGER
            )"""
        )
        # ---- Pembangunan bertahap: status fasilitas desa ----
        conn.execute(
            """CREATE TABLE IF NOT EXISTS pembangunan(
                kunci TEXT PRIMARY KEY,
                nama TEXT NOT NULL,
                biaya INTEGER NOT NULL,
                kol INTEGER NOT NULL,
                bar INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'belum',
                dibangun_pada TEXT
            )"""
        )
        # Seed fasilitas (idempoten): baris yang sudah ada TIDAK ditimpa —
        # status terbangun & tanggal bangunnya dipertahankan apa adanya.
        for f in FASILITAS:
            conn.execute(
                "INSERT INTO pembangunan(kunci, nama, biaya, kol, bar) "
                "VALUES(%s,%s,%s,%s,%s) ON CONFLICT (kunci) DO NOTHING",
                (f["kunci"], f["nama"], f["biaya"], f["kol"], f["bar"]),
            )


def hash_pin(pin: str, salt_hex: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", pin.encode(), bytes.fromhex(salt_hex), 120_000
    ).hex()


def warga_publik(row, peta=None):
    """Data publik warga. `jabatan` = label jabatan aktif hasil pemilu
    (informasi publik desa, mis. 'Kepala Desa') atau None. Jalur daftar
    (pagination) meneruskan `peta` dari peta_jabatan() supaya tidak query
    per baris; pemanggil tunggal boleh mengosongkannya (dicarikan sendiri)."""
    jab = None
    if peta is not None:
        jab = peta.get(row["id"])
    else:
        try:
            with db() as conn:
                r = conn.execute(
                    "SELECT jabatan, wilayah FROM jabatan WHERE warga_id=%s",
                    (row["id"],),
                ).fetchone()
            if r:
                jab = label_jabatan(r["jabatan"], r["wilayah"])
        except psycopg.Error:
            jab = None
    return {
        "username": row["username"],
        "warna_baju": row["warna_baju"],
        "warna_kulit": row["warna_kulit"],
        "topi": row["topi"],
        "nomor_rumah": row["nomor_rumah"],
        "blok": row["blok"],
        "kavling": row["kavling"],
        "jabatan": jab,
    }


def warga_privat(row):
    """Data warga untuk PEMILIKNYA sendiri (lewat sesi): warga_publik + NIK
    + tanggal daftar. NIK lengkap SENGAJA tidak masuk warga_publik, jadi
    tidak tampil di /api/warga (daftar publik) maupun WebSocket — kartu
    rumah warga lain tetap hanya memuat data yang memang sudah publik."""
    d = warga_publik(row)
    d["nik"] = row["nik"]
    d["terdaftar"] = (row["created_at"] or "")[:10]
    # Ringkasan keluarga miliknya sendiri (No. KK + perannya) untuk klien.
    d["keluarga"] = None
    kid = row["keluarga_id"] if "keluarga_id" in row.keys() else None
    if kid:
        k = None
        try:
            with db() as conn:
                k = conn.execute(
                    "SELECT no_kk FROM keluarga WHERE id=%s", (kid,)
                ).fetchone()
        except psycopg.Error:
            k = None
        if k:
            d["keluarga"] = {
                "no_kk": k["no_kk"],
                "peran": PERAN_LABEL.get(row["peran"], "Anggota"),
            }
    return d


def data_keluarga_saya(row):
    """Data Kartu Keluarga untuk keluarga si peminta (WAJIB lewat sesi).

    Keputusan privasi: NIK semua anggota SENGAJA disertakan di sini — KK
    memang memuat NIK anggotanya — tapi data ini hanya dikirim ke warga
    yang login DAN anggota keluarga itu sendiri. Endpoint publik
    (/api/warga) dan WebSocket tidak memuat NIK maupun data keluarga.
    Alamat keluarga = alamat rumah Kepala Keluarga."""
    kid = row["keluarga_id"] if "keluarga_id" in row.keys() else None
    if not kid:
        return None
    with _db_lock, db() as conn:
        k = conn.execute("SELECT * FROM keluarga WHERE id=%s", (kid,)).fetchone()
        rows = conn.execute(
            "SELECT * FROM warga WHERE keluarga_id=%s ORDER BY nomor_rumah ASC",
            (kid,),
        ).fetchall()
    if not k or not rows:
        return None
    kepala = next((r for r in rows if r["peran"] == "kepala"), rows[0])
    anggota = [
        {
            "username": r["username"],
            "nik": r["nik"],
            "peran": PERAN_LABEL.get(r["peran"], "Anggota"),
            "terdaftar": (r["created_at"] or "")[:10],
            "nomor_rumah": r["nomor_rumah"],
            "blok": r["blok"],
            "kavling": r["kavling"],
        }
        for r in rows
    ]
    # Kepala Keluarga selalu baris pertama tabel KK (sort stabil: sisanya
    # tetap urut nomor rumah).
    anggota.sort(key=lambda a: 0 if a["peran"] == "Kepala Keluarga" else 1)
    return {
        "no_kk": k["no_kk"],
        "kepala": kepala["username"],
        "alamat": {
            "blok": kepala["blok"],
            "kavling": kepala["kavling"],
            "nomor_rumah": kepala["nomor_rumah"],
        },
        "kamu": {
            "username": row["username"],
            "peran": PERAN_LABEL.get(row["peran"], "Anggota"),
        },
        "anggota": anggota,
    }


def warga_dari_token_str(token):
    """Token sesi -> baris warga (atau None). Dipakai HTTP Bearer & WebSocket."""
    if not token:
        return None
    with _db_lock, db() as conn:
        return conn.execute(
            "SELECT w.* FROM sesi s JOIN warga w ON w.id=s.warga_id WHERE s.token=%s",
            (token,),
        ).fetchone()


# ================= PEMILU: data, hasil, penetapan pemenang =================

def status_gerbang_pemilu(conn):
    """Gerbang pemilu -> {min_warga, jumlah_warga, terkunci}. Periode hanya
    boleh dibuka bila jumlah warga terdaftar >= PEMILU_MIN_WARGA (10.000)."""
    n = conn.execute("SELECT COUNT(*) c FROM warga").fetchone()["c"]
    return {
        "min_warga": PEMILU_MIN_WARGA,
        "jumlah_warga": n,
        "terkunci": n < PEMILU_MIN_WARGA,
    }


def pemilu_terbaru(conn):
    """Periode pemilu terakhir (apa pun statusnya), atau None."""
    return conn.execute("SELECT * FROM pemilu ORDER BY id DESC LIMIT 1").fetchone()


def balapan_data(conn, pemilu, jabatan, wilayah):
    """Satu 'balapan' (jabatan+wilayah): kandidat urut waktu daftar, lengkap
    dengan jumlah suara + persen berjalan, dan pemenang bila sudah selesai.
    Aturan pemenang/seri: suara terbanyak; seri -> kandidat yang mendaftar
    lebih dulu (dibuat_pada, lalu id terkecil)."""
    rows = conn.execute(
        """SELECT k.*, w.username FROM kandidat k JOIN warga w ON w.id=k.warga_id
           WHERE k.pemilu_id=%s AND k.jabatan=%s AND k.wilayah=%s
           ORDER BY k.dibuat_pada ASC, k.id ASC""",
        (pemilu["id"], jabatan, wilayah),
    ).fetchall()
    hitung = {
        r["kandidat_id"]: r["c"]
        for r in conn.execute(
            """SELECT kandidat_id, COUNT(*) c FROM suara
               WHERE pemilu_id=%s AND jabatan=%s AND wilayah=%s GROUP BY kandidat_id""",
            (pemilu["id"], jabatan, wilayah),
        )
    }
    total = sum(hitung.values())
    kandidat = [
        {
            "id": r["id"],
            "username": r["username"],
            "jabatan": jabatan,
            "wilayah": wilayah,
            "visi": r["visi"],
            "misi": r["misi"],
            "suara": hitung.get(r["id"], 0),
            "persen": round(100.0 * hitung.get(r["id"], 0) / total, 1) if total else 0.0,
        }
        for r in rows
    ]
    pemenang_id = None
    if pemilu["status"] == "selesai" and kandidat:
        # kandidat sudah urut daftar; max suara pertama yang ditemukan = menang seri
        pemenang_id = max(kandidat, key=lambda k: k["suara"])["id"]
    return {
        "jabatan": jabatan,
        "wilayah": wilayah,
        "label": label_jabatan(jabatan, wilayah),
        "total_suara": total,
        "kandidat": kandidat,
        "pemenang_id": pemenang_id,
    }


def tetapkan_pemenang(conn, pemilu):
    """Saat periode ditutup: tetapkan pemenang tiap balapan yang punya
    kandidat ke tabel `jabatan`. Pemegang lama balapan yang sama digantikan;
    balapan tanpa kandidat tidak diutak-atik (pejabat lamanya tetap menjabat
    sampai ada pemilu berikutnya untuk balapan itu yang menghasilkan
    pemenang). Pemenang yang sebelumnya memegang jabatan lain melepas
    jabatan lamanya (barisnya tertimpa)."""
    sekarang = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    balapan = conn.execute(
        "SELECT DISTINCT jabatan, wilayah FROM kandidat WHERE pemilu_id=%s",
        (pemilu["id"],),
    ).fetchall()
    pemenang = []
    for b in balapan:
        data = balapan_data(conn, pemilu, b["jabatan"], b["wilayah"])
        if not data["kandidat"]:
            continue
        kid = data["pemenang_id"] if data["pemenang_id"] is not None else \
            max(data["kandidat"], key=lambda k: k["suara"])["id"]
        krow = conn.execute("SELECT warga_id FROM kandidat WHERE id=%s", (kid,)).fetchone()
        if krow:
            pemenang.append((krow["warga_id"], b["jabatan"], b["wilayah"]))
    for _, jabatan, wilayah in pemenang:
        conn.execute(
            "DELETE FROM jabatan WHERE jabatan=%s AND wilayah=%s", (jabatan, wilayah)
        )
    for warga_id, jabatan, wilayah in pemenang:
        conn.execute(
            """INSERT INTO jabatan(warga_id, jabatan, wilayah, sejak, pemilu_id)
               VALUES(%s,%s,%s,%s,%s)
               ON CONFLICT (warga_id) DO UPDATE SET
                 jabatan=EXCLUDED.jabatan, wilayah=EXCLUDED.wilayah,
                 sejak=EXCLUDED.sejak, pemilu_id=EXCLUDED.pemilu_id""",
            (warga_id, jabatan, wilayah, sekarang, pemilu["id"]),
        )
    return pemenang


def daftar_pejabat(conn):
    """Semua pejabat aktif saat ini (untuk panel pemilu publik)."""
    return [
        {
            "username": r["username"],
            "jabatan": r["jabatan"],
            "wilayah": r["wilayah"],
            "label": label_jabatan(r["jabatan"], r["wilayah"]),
        }
        for r in conn.execute(
            """SELECT j.*, w.username FROM jabatan j JOIN warga w ON w.id=j.warga_id
               ORDER BY CASE j.jabatan WHEN 'kades' THEN 0 WHEN 'rw' THEN 1 ELSE 2 END,
                        j.wilayah ASC"""
        )
    ]


# ================= PEMBANGUNAN: daftar status fasilitas =================

def daftar_pembangunan(conn):
    """Status semua fasilitas (urut tampil = urutan FASILITAS, biaya
    termurah dulu). Baris tabel yang hilang (DB sangat lama) dianggap
    belum terbangun; seed di init_db normalnya selalu melengkapinya."""
    rows = {r["kunci"]: r for r in conn.execute("SELECT * FROM pembangunan")}
    hasil = []
    for f in FASILITAS:
        r = rows.get(f["kunci"])
        terbangun = bool(r) and r["status"] == "terbangun"
        hasil.append({
            "kunci": f["kunci"],
            "nama": f["nama"],
            "biaya": f["biaya"],
            "kol": f["kol"],
            "bar": f["bar"],
            "blok": f["bar"] * BLOK_KOLOM + f["kol"] + 1,
            "status": "terbangun" if terbangun else "belum",
            "dibangun_pada": r["dibangun_pada"] if r else None,
        })
    return hasil


# ================= CHAT BALAI DESA (PostgreSQL) =================

def simpan_chat(warga_id, username, isi, sistem=0):
    """Simpan pesan; kembalikan string jam lokal 'HH:MM' untuk ditampilkan.
    sistem=1 menandai pesan dari desa (sambutan Pak Kades), bukan warga."""
    sekarang = datetime.now()
    with _db_lock, db() as conn:
        conn.execute(
            "INSERT INTO chat(warga_id, username, isi, created_at, sistem) VALUES(%s,%s,%s,%s,%s)",
            (warga_id, username, isi, sekarang.strftime("%Y-%m-%d %H:%M:%S"), 1 if sistem else 0),
        )
    return sekarang.strftime("%H:%M")


def chat_terakhir(batas=CHAT_RIWAYAT):
    with _db_lock, db() as conn:
        rows = conn.execute(
            "SELECT username, isi, created_at, sistem FROM chat ORDER BY id DESC LIMIT %s",
            (batas,),
        ).fetchall()
    return [
        {"u": r["username"], "isi": r["isi"], "jam": (r["created_at"] or "")[11:16],
         "sistem": bool(r["sistem"])}
        for r in reversed(rows)
    ]


# ================= SAMBUTAN PAK KADES (warga baru) =================
# Keputusan Fahmi 20 Nov 2026: "Kades akan menyambut warga baru". Setiap
# pendaftaran yang BERHASIL (dan hanya itu — login ulang tidak lewat sini)
# menghasilkan tepat satu pesan sambutan dari pengirim sistem "Pak Kades":
# disimpan di chat Balai Desa (warga_id 0, sistem=1), disiarkan langsung
# via WebSocket ke yang sedang online, dan teksnya dikembalikan ke
# pendaftar untuk dialog sambutan di kliennya.
PENGIRIM_SISTEM = "Pak Kades"


def teks_sambutan_warga_baru(row):
    """Susun teks sambutan dari data warga yang baru terdaftar: nomor urut
    warga (= nomor rumah), alamat rumah, RT/RW rumahnya, dan keluarganya."""
    rt, rw = wilayah_dari_blok(row["blok"])
    teks = (
        f"Selamat datang @{row['username']}, warga ke-{row['nomor_rumah']} "
        f"Desa Pinarak. Rumahmu No. {row['nomor_rumah']}, Blok {row['blok']} "
        f"Kavling {row['kavling']}, RT {rt:03d}/RW {rw:02d}."
    )
    keluarga = data_keluarga_saya(row)
    kepala = keluarga["kepala"] if keluarga else None
    if kepala and kepala != row["username"]:
        teks += f" Keluargamu dipimpin @{kepala}."
    elif kepala:
        teks += " Kamu sendiri Kepala Keluarganya."
    teks += " Silakan masuk, pintu desa selalu terbuka."
    return teks


def sambutan_warga_baru(row):
    """Simpan sambutan Pak Kades ke chat + siarkan ke warga online;
    kembalikan teksnya. Dipanggil SEKALI per pendaftaran berhasil."""
    teks = teks_sambutan_warga_baru(row)
    jam = simpan_chat(0, PENGIRIM_SISTEM, teks, sistem=1)
    ws_broadcast({"jenis": "chat", "u": PENGIRIM_SISTEM, "isi": teks,
                  "jam": jam, "sistem": True})
    return teks


# ================= WEBSOCKET (RFC 6455, stdlib murni) =================
# ThreadingHTTPServer memberi 1 thread per koneksi; koneksi WS mengambil alih
# soketnya di dalam thread handler itu dan berputar sampai putus.

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"  # GUID RFC 6455 §4.1 (tetap)
WS_SEKALI_BACA = 65536      # batas ukuran 1 pesan WS dari klien
WS_TIMEOUT_DETIK = 30       # tanpa detak/pong/aktivitas apa pun -> putus
WS_PING_TIAP = 20           # detik antar ping server -> klien

_ws_lock = threading.Lock()
_ws_klien = {}              # id(klien) -> KlienWS (semua koneksi, termasuk tamu)
_ws_pemain = {}             # username -> {"rupa","x","z","yaw","n" (jumlah koneksi)}
_ws_chat_terakhir = {}      # username -> epoch kirim chat terakhir (rate limit)


def _bingkai(op, muatan: bytes) -> bytes:
    kepala = bytearray([0x80 | op])
    n = len(muatan)
    if n < 126:
        kepala.append(n)
    elif n < 65536:
        kepala.append(126)
        kepala += struct.pack(">H", n)
    else:
        kepala.append(127)
        kepala += struct.pack(">Q", n)
    return bytes(kepala) + muatan


class KlienWS:
    def __init__(self, sock, row):
        self.sock = sock
        self.username = row["username"] if row else None   # None = tamu penonton
        self.warga_id = row["id"] if row else None
        self.rupa = warga_publik(row) if row else None
        self.terakhir = time.time()       # aktivitas terakhir (pesan/pong apa pun)
        self.ping_terakhir = time.time()
        self.kunci_kirim = threading.Lock()

    def kirim_bingkai(self, op, muatan: bytes):
        with self.kunci_kirim:
            self.sock.sendall(_bingkai(op, muatan))

    def kirim_obj(self, obj):
        self.kirim_bingkai(0x1, json.dumps(obj, ensure_ascii=False).encode())

    def tutup(self):
        try:
            self.sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        try:
            self.sock.close()
        except OSError:
            pass


def _pemain_publik(username):
    p = _ws_pemain[username]
    r = p["rupa"]
    return {
        "u": username, "baju": r["warna_baju"], "kulit": r["warna_kulit"],
        "topi": r["topi"], "x": p["x"], "z": p["z"], "yaw": p["yaw"],
        "jabatan": r.get("jabatan"),
    }


def ws_broadcast(obj, kecuali=None):
    teks = json.dumps(obj, ensure_ascii=False)
    with _ws_lock:
        daftar = list(_ws_klien.values())
    for k in daftar:
        if kecuali is not None and k is kecuali:
            continue
        try:
            k.kirim_bingkai(0x1, teks.encode())
        except OSError:
            k.tutup()


def _ws_daftar(klien):
    """Daftarkan koneksi; True bila username ini pemain BARU (perlu broadcast masuk)."""
    with _ws_lock:
        _ws_klien[id(klien)] = klien
        if not klien.username:
            return False
        p = _ws_pemain.get(klien.username)
        if p is None:
            _ws_pemain[klien.username] = {
                "rupa": klien.rupa, "x": 8.0, "z": 22.0, "yaw": 0.35, "n": 1,
            }
            return True
        p["n"] += 1
        return False


def _ws_hapus(klien):
    """Cabut koneksi; True bila itu koneksi TERAKHIR username (perlu broadcast keluar)."""
    with _ws_lock:
        _ws_klien.pop(id(klien), None)
        if not klien.username:
            return False
        p = _ws_pemain.get(klien.username)
        if p is None:
            return False
        p["n"] -= 1
        if p["n"] <= 0:
            del _ws_pemain[klien.username]
            return True
        return False


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC, **kwargs)

    def log_message(self, fmt, *args):
        pass

    def kirim_json(self, kode, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(kode)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def baca_json(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > 65536:
                return None
            return json.loads(self.rfile.read(n).decode())
        except Exception:
            return None

    def warga_dari_token(self):
        auth = self.headers.get("Authorization") or ""
        if not auth.startswith("Bearer "):
            return None
        return warga_dari_token_str(auth[7:].strip())

    # ---------- WebSocket: ambil alih soket di thread handler ini ----------

    def _baca_persis(self, mentah, n):
        # SENGAJA recv langsung, BUKAN makefile(): file object soket CPython
        # jadi tidak bisa dipakai lagi sesudah sekali timeout
        # (OSError "cannot read from timed out object"); recv tidak begitu.
        buf = bytearray()
        while len(buf) < n:
            potong = mentah.recv(n - len(buf))
            if not potong:
                raise ConnectionError("soket putus")
            buf += potong
        return bytes(buf)

    def tangani_ws(self, query):
        kunci = self.headers.get("Sec-WebSocket-Key")
        if not kunci or "websocket" not in (self.headers.get("Upgrade") or "").lower():
            return self.kirim_json(400, {"error": "Bukan permintaan WebSocket"})
        token = (parse_qs(query).get("token") or [""])[0]
        row = warga_dari_token_str(token) if token else None
        terima = base64.b64encode(
            hashlib.sha1((kunci + WS_GUID).encode()).digest()
        ).decode()
        self.close_connection = True
        self.connection.sendall((
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {terima}\r\n\r\n"
        ).encode())
        klien = KlienWS(self.connection, row)
        pemain_baru = _ws_daftar(klien)
        try:
            with _ws_lock:
                daftar_pemain = [_pemain_publik(u) for u in _ws_pemain]
            klien.kirim_obj({
                "jenis": "sambutan", "kamu": klien.username,
                "pemain": daftar_pemain, "chat": chat_terakhir(),
            })
            if pemain_baru:
                ws_broadcast({"jenis": "masuk", "pemain": _pemain_publik(klien.username)},
                             kecuali=klien)
            self.connection.settimeout(2.0)
            mentah = self.connection
            frag = bytearray()
            frag_op = None
            while True:
                try:
                    kepala = self._baca_persis(mentah, 2)
                except socket.timeout:
                    kini = time.time()
                    if kini - klien.terakhir > WS_TIMEOUT_DETIK:
                        break
                    if kini - klien.ping_terakhir >= WS_PING_TIAP:
                        klien.ping_terakhir = kini
                        try:
                            klien.kirim_bingkai(0x9, b"")
                        except OSError:
                            break
                    continue
                except (ConnectionError, OSError):
                    break
                b1, b2 = kepala
                fin, op = b1 & 0x80, b1 & 0x0F
                bertopeng, panjang = b2 & 0x80, b2 & 0x7F
                try:
                    if panjang == 126:
                        panjang = struct.unpack(">H", self._baca_persis(mentah, 2))[0]
                    elif panjang == 127:
                        panjang = struct.unpack(">Q", self._baca_persis(mentah, 8))[0]
                    if panjang > WS_SEKALI_BACA:
                        break
                    topeng = self._baca_persis(mentah, 4) if bertopeng else None
                    muatan = self._baca_persis(mentah, panjang) if panjang else b""
                except (socket.timeout, ConnectionError, OSError):
                    break
                if topeng:
                    muatan = bytes(b ^ topeng[i % 4] for i, b in enumerate(muatan))
                klien.terakhir = time.time()
                if op == 0x8:      # close
                    try:
                        klien.kirim_bingkai(0x8, b"")
                    except OSError:
                        pass
                    break
                if op == 0x9:      # ping -> pong
                    try:
                        klien.kirim_bingkai(0xA, muatan)
                    except OSError:
                        break
                    continue
                if op == 0xA:      # pong
                    continue
                if op in (0x0, 0x1, 0x2):
                    if op != 0x0:
                        frag, frag_op = bytearray(muatan), op
                    else:
                        frag += muatan
                    if not fin:
                        continue
                    if frag_op == 0x1:
                        self._pesan_ws(klien, bytes(frag))
                    frag, frag_op = bytearray(), None
        finally:
            if _ws_hapus(klien):
                ws_broadcast({"jenis": "keluar", "u": klien.username})
            klien.tutup()

    def _pesan_ws(self, klien, data):
        try:
            msg = json.loads(data.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return
        if not isinstance(msg, dict):
            return
        jenis = msg.get("jenis")
        if jenis == "detak":
            return
        if jenis == "posisi":
            if not klien.username:
                return  # tamu tidak tampil sebagai karakter
            try:
                x, z, yaw = float(msg["x"]), float(msg["z"]), float(msg["yaw"])
            except (KeyError, TypeError, ValueError):
                return
            x = max(-BATAS_X, min(BATAS_X, x))
            z = max(-BATAS_Z, min(BATAS_Z, z))
            yaw = max(-1e4, min(1e4, yaw))
            with _ws_lock:
                p = _ws_pemain.get(klien.username)
                if p is None:
                    return
                p["x"], p["z"], p["yaw"] = x, z, yaw
            ws_broadcast({"jenis": "posisi", "u": klien.username, "x": x, "z": z, "yaw": yaw},
                         kecuali=klien)
            return
        if jenis == "chat":
            if not klien.username:
                try:
                    klien.kirim_obj({"jenis": "galat",
                                     "pesan": "Masuk dulu pakai Kartu Warga untuk ikut chat Balai Desa."})
                except OSError:
                    pass
                return
            isi = str(msg.get("isi") or "")
            isi = re.sub(r"[\x00-\x1f\x7f]", " ", isi).strip()
            if not isi:
                return
            if len(isi) > CHAT_MAKS:
                try:
                    klien.kirim_obj({"jenis": "galat",
                                     "pesan": f"Pesan maksimal {CHAT_MAKS} karakter."})
                except OSError:
                    pass
                return
            kini = time.time()
            if kini - _ws_chat_terakhir.get(klien.username, 0.0) < CHAT_JEDA:
                try:
                    klien.kirim_obj({"jenis": "galat",
                                     "pesan": "Sabar, kirimnya pelan-pelan ya (maks 1 pesan / 1,5 detik)."})
                except OSError:
                    pass
                return
            _ws_chat_terakhir[klien.username] = kini
            jam = simpan_chat(klien.warga_id, klien.username, isi)
            ws_broadcast({"jenis": "chat", "u": klien.username, "isi": isi, "jam": jam})
            return

    def do_GET(self):
        u = urlparse(self.path)
        path = u.path
        if path == "/ws":
            return self.tangani_ws(u.query)
        if path == "/api/warga":
            q = parse_qs(u.query)
            try:
                limit = min(500, max(1, int(q.get("limit", ["100"])[0])))
                offset = max(0, int(q.get("offset", ["0"])[0]))
            except ValueError:
                return self.kirim_json(400, {"error": "limit/offset tidak valid"})
            urut = q.get("urut", ["terlama"])[0]
            arah = "DESC" if urut == "terbaru" else "ASC"
            with _db_lock, db() as conn:
                total = conn.execute("SELECT COUNT(*) c FROM warga").fetchone()["c"]
                rows = conn.execute(
                    f"SELECT * FROM warga ORDER BY nomor_rumah {arah} LIMIT %s OFFSET %s",
                    (limit, offset),
                ).fetchall()
                peta = peta_jabatan(conn)
            return self.kirim_json(200, {
                "warga": [warga_publik(r, peta) for r in rows],
                "total": total, "limit": limit, "offset": offset,
            })
        if path == "/api/statistik":
            with _db_lock, db() as conn:
                n = conn.execute("SELECT COUNT(*) c FROM warga").fetchone()["c"]
            return self.kirim_json(200, {
                "warga": n, "rumah": n, "terisi": n, "kapasitas": KAPASITAS,
                "blok_total": BLOK_KOLOM * BLOK_BARIS, "per_blok": PER_BLOK,
            })
        if path == "/api/saya":
            row = self.warga_dari_token()
            if not row:
                return self.kirim_json(401, {"error": "Belum masuk"})
            return self.kirim_json(200, {"warga": warga_privat(row)})
        if path == "/api/keluarga-saya":
            row = self.warga_dari_token()
            if not row:
                return self.kirim_json(401, {"error": "Belum masuk"})
            data = data_keluarga_saya(row)
            if not data:
                return self.kirim_json(404, {"error": "Keluarga belum terbentuk"})
            return self.kirim_json(200, {"keluarga": data})
        if path == "/api/pemilu":
            return self.pemilu_get(u.query)
        if path == "/api/pembangunan":
            with _db_lock, db() as conn:
                daftar = daftar_pembangunan(conn)
            n = sum(1 for f in daftar if f["status"] == "terbangun")
            return self.kirim_json(200, {
                "fasilitas": daftar, "terbangun": n, "total": len(daftar),
            })
        if path.startswith("/api/"):
            return self.kirim_json(404, {"error": "Tidak ditemukan"})
        return super().do_GET()

    # ---------- Pemilu ----------

    def admin_sah(self):
        """Token admin dari header X-Admin-Token dicocokkan (compare_digest)
        dengan ENV PINARAK_ADMIN_TOKEN. Tanpa env -> selalu tidak sah."""
        if not ADMIN_TOKEN:
            return False
        return hmac.compare_digest(self.headers.get("X-Admin-Token") or "", ADMIN_TOKEN)

    def pemilu_get(self, query):
        """Data pemilu untuk panel klien (publik; bagian personal hanya
        bila ada sesi). Tanpa parameter: balapan Kepala Desa + (bila login)
        balapan RT & RW si peminta. ?jabatan=rt|rw|kades&wilayah=N meminta
        satu balapan tertentu."""
        q = parse_qs(query)
        row = self.warga_dari_token()
        with _db_lock, db() as conn:
            p = pemilu_terbaru(conn)
            gerbang = status_gerbang_pemilu(conn)
            pejabat = daftar_pejabat(conn)
            wilayah_saya = None
            if row:
                rt, rw = wilayah_dari_blok(row["blok"])
                wilayah_saya = {"rt": rt, "rw": rw}
            balapan = []
            suara_saya = {}
            kandidat_saya = None
            if p:
                daftar = [("kades", 0)]
                j = q.get("jabatan", [""])[0]
                if j in JABATAN_LABEL:
                    try:
                        w = int(q.get("wilayah", ["0"])[0])
                    except ValueError:
                        w = 0
                    daftar = [(j, 0 if j == "kades" else w)]
                elif wilayah_saya:
                    daftar += [("rt", wilayah_saya["rt"]), ("rw", wilayah_saya["rw"])]
                balapan = [balapan_data(conn, p, jab, wil) for jab, wil in daftar]
                if row:
                    for s in conn.execute(
                        "SELECT jabatan, kandidat_id FROM suara WHERE pemilu_id=%s AND pemilih_id=%s",
                        (p["id"], row["id"]),
                    ):
                        suara_saya[s["jabatan"]] = s["kandidat_id"]
                    k = conn.execute(
                        "SELECT jabatan, wilayah FROM kandidat WHERE pemilu_id=%s AND warga_id=%s",
                        (p["id"], row["id"]),
                    ).fetchone()
                    if k:
                        kandidat_saya = {"jabatan": k["jabatan"], "wilayah": k["wilayah"]}
        return self.kirim_json(200, {
            "pemilu": None if not p else {
                "id": p["id"], "status": p["status"],
                "dibuka_pada": p["dibuka_pada"], "ditutup_pada": p["ditutup_pada"],
            },
            # Gerbang 10.000 warga: klien menampilkan progres & mengunci
            # panel selama jumlah warga belum mencapai ambang.
            "min_warga": gerbang["min_warga"],
            "jumlah_warga": gerbang["jumlah_warga"],
            "terkunci": gerbang["terkunci"],
            "pejabat": pejabat,
            "wilayah_saya": wilayah_saya,
            "balapan": balapan,
            "suara_saya": suara_saya,
            "kandidat_saya": kandidat_saya,
        })

    def pemilu_calon(self):
        row = self.warga_dari_token()
        if not row:
            return self.kirim_json(401, {"error": "Masuk dulu untuk mencalonkan diri"})
        data = self.baca_json()
        if not data:
            return self.kirim_json(400, {"error": "Data tidak valid"})
        jabatan = str(data.get("jabatan") or "")
        visi = str(data.get("visi") or "").strip()
        misi = str(data.get("misi") or "").strip()
        if jabatan not in JABATAN_LABEL:
            return self.kirim_json(400, {"error": "Jabatan tidak dikenal (rt/rw/kades)"})
        if not visi or len(visi) > VISI_MAKS:
            return self.kirim_json(400, {"error": f"Visi wajib diisi, maksimal {VISI_MAKS} karakter"})
        if not misi or len(misi) > MISI_MAKS:
            return self.kirim_json(400, {"error": f"Misi wajib diisi, maksimal {MISI_MAKS} karakter"})
        # Wilayah SELALU dihitung server dari blok rumah kandidat sendiri.
        rt, rw = wilayah_dari_blok(row["blok"])
        wilayah = {"kades": 0, "rw": rw, "rt": rt}[jabatan]
        with _db_lock, db() as conn:
            p = pemilu_terbaru(conn)
            if not p or p["status"] != "pencalonan":
                return self.kirim_json(409, {"error": "Pencalonan sedang tidak dibuka"})
            ada = conn.execute(
                "SELECT id FROM kandidat WHERE pemilu_id=%s AND warga_id=%s",
                (p["id"], row["id"]),
            ).fetchone()
            if ada:
                return self.kirim_json(409, {"error": "Kamu sudah mencalonkan diri di periode ini (1 warga hanya boleh 1 jabatan)"})
            kandidat_id = conn.execute(
                """INSERT INTO kandidat(pemilu_id, warga_id, jabatan, wilayah, visi, misi)
                   VALUES(%s,%s,%s,%s,%s,%s) RETURNING id""",
                (p["id"], row["id"], jabatan, wilayah, visi, misi),
            ).fetchone()["id"]
        return self.kirim_json(201, {
            "ok": True, "kandidat_id": kandidat_id,
            "jabatan": jabatan, "wilayah": wilayah,
            "label": label_jabatan(jabatan, wilayah),
        })

    def pemilu_pilih(self):
        row = self.warga_dari_token()
        if not row:
            return self.kirim_json(401, {"error": "Masuk dulu untuk memilih"})
        data = self.baca_json()
        if not data:
            return self.kirim_json(400, {"error": "Data tidak valid"})
        try:
            kandidat_id = int(data.get("kandidat_id"))
        except (TypeError, ValueError):
            return self.kirim_json(400, {"error": "kandidat_id tidak valid"})
        rt, rw = wilayah_dari_blok(row["blok"])
        hak = {"kades": 0, "rw": rw, "rt": rt}
        with _db_lock, db() as conn:
            p = pemilu_terbaru(conn)
            if not p or p["status"] != "pemungutan":
                return self.kirim_json(409, {"error": "Pemungutan suara sedang tidak berlangsung"})
            k = conn.execute(
                "SELECT * FROM kandidat WHERE id=%s AND pemilu_id=%s",
                (kandidat_id, p["id"]),
            ).fetchone()
            if not k:
                return self.kirim_json(404, {"error": "Kandidat tidak ditemukan di periode ini"})
            # Hak pilih divalidasi dari alamat rumah PEMILIH (bukan klaim klien):
            # RT hanya se-RT, RW hanya se-RW, Kepala Desa untuk semua warga.
            if k["wilayah"] != hak[k["jabatan"]]:
                return self.kirim_json(403, {"error": "Kandidat itu bukan untuk wilayahmu — kamu hanya bisa memilih di RT/RW rumahmu sendiri"})
            sudah = conn.execute(
                """SELECT id FROM suara WHERE pemilu_id=%s AND pemilih_id=%s
                   AND jabatan=%s AND wilayah=%s""",
                (p["id"], row["id"], k["jabatan"], k["wilayah"]),
            ).fetchone()
            if sudah:
                return self.kirim_json(409, {"error": "Kamu sudah memilih untuk jabatan ini"})
            cur = conn.execute(
                """INSERT INTO suara(pemilu_id, pemilih_id, jabatan, wilayah, kandidat_id)
                   VALUES(%s,%s,%s,%s,%s)
                   ON CONFLICT (pemilu_id, pemilih_id, jabatan, wilayah) DO NOTHING""",
                (p["id"], row["id"], k["jabatan"], k["wilayah"], kandidat_id),
            )
            if cur.rowcount == 0:
                # Lapis pengaman kedua di atas cek manual di atas (yang,
                # bersama _db_lock, sudah mencegah ini di dalam satu
                # proses): UNIQUE suara menolak suara ganda antar-replika.
                return self.kirim_json(409, {"error": "Kamu sudah memilih untuk jabatan ini"})
        return self.kirim_json(200, {"ok": True, "kandidat_id": kandidat_id})

    def admin_pemilu(self, aksi):
        if not self.admin_sah():
            return self.kirim_json(403, {"error": "Token admin tidak sah"})
        with _db_lock, db() as conn:
            p = pemilu_terbaru(conn)
            if aksi == "buka":
                # Gerbang 10.000 warga (keputusan Fahmi): selama warga
                # terdaftar belum mencapai ambang, pemilu TIDAK bisa dibuka.
                g = status_gerbang_pemilu(conn)
                if g["terkunci"]:
                    return self.kirim_json(403, {"error":
                        f"Pemilu masih terkunci: baru {g['jumlah_warga']} dari "
                        f"{g['min_warga']} warga terdaftar. Pemilu pertama dibuka "
                        f"setelah {g['min_warga']} warga."})
                if p and p["status"] != "selesai":
                    return self.kirim_json(409, {"error": "Masih ada periode pemilu yang belum selesai"})
                pemilu_id = conn.execute(
                    "INSERT INTO pemilu(status) VALUES('pencalonan') RETURNING id"
                ).fetchone()["id"]
                return self.kirim_json(201, {"ok": True, "pemilu_id": pemilu_id, "status": "pencalonan"})
            if not p:
                return self.kirim_json(404, {"error": "Belum ada periode pemilu"})
            if aksi == "fase":
                data = self.baca_json() or {}
                fase = str(data.get("fase") or "")
                if fase != "pemungutan" or p["status"] != "pencalonan":
                    return self.kirim_json(400, {"error": "Perpindahan fase tidak sah (hanya pencalonan -> pemungutan; tutup lewat /tutup)"})
                conn.execute("UPDATE pemilu SET status='pemungutan' WHERE id=%s", (p["id"],))
                return self.kirim_json(200, {"ok": True, "pemilu_id": p["id"], "status": "pemungutan"})
            if aksi == "tutup":
                if p["status"] != "pemungutan":
                    return self.kirim_json(400, {"error": "Pemilu hanya bisa ditutup dari fase pemungutan"})
                p2 = dict(p); p2["status"] = "selesai"
                pemenang = tetapkan_pemenang(conn, p2)
                sekarang = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                conn.execute(
                    "UPDATE pemilu SET status='selesai', ditutup_pada=%s WHERE id=%s",
                    (sekarang, p["id"]),
                )
                return self.kirim_json(200, {
                    "ok": True, "pemilu_id": p["id"], "status": "selesai",
                    "pemenang": [
                        {"jabatan": j, "wilayah": w, "label": label_jabatan(j, w)}
                        for _, j, w in pemenang
                    ],
                })
        return self.kirim_json(404, {"error": "Aksi admin tidak dikenal"})

    # ---------- Pembangunan bertahap (admin) ----------

    def admin_pembangunan_bangun(self):
        """Tandai satu fasilitas TERBANGUN. Inilah titik di mana keputusan
        Pak Kades (dari usulan warga di komentar Instagram) masuk ke desa:
        klien membaca status ini saat halaman dimuat dan model 3D-nya
        berdiri di blok lahannya. Kas IG dipotong manual di ledger IG
        saat pembangunan diumumkan — tidak otomatis dari sini."""
        if not self.admin_sah():
            return self.kirim_json(403, {"error": "Token admin tidak sah"})
        data = self.baca_json()
        if not data:
            return self.kirim_json(400, {"error": "Data tidak valid"})
        kunci = str(data.get("kunci") or "")
        f = FASILITAS_PER_KUNCI.get(kunci)
        if not f:
            return self.kirim_json(404, {"error": "Fasilitas tidak dikenal"})
        sekarang = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with _db_lock, db() as conn:
            r = conn.execute(
                "SELECT status FROM pembangunan WHERE kunci=%s", (kunci,)
            ).fetchone()
            if r and r["status"] == "terbangun":
                return self.kirim_json(409, {"error": f"{f['nama']} sudah berdiri"})
            conn.execute(
                "UPDATE pembangunan SET status='terbangun', dibangun_pada=%s WHERE kunci=%s",
                (sekarang, kunci),
            )
        return self.kirim_json(201, {
            "ok": True, "kunci": kunci, "nama": f["nama"],
            "dibangun_pada": sekarang,
        })

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/daftar":
            return self.daftar()
        if path == "/api/login":
            return self.login()
        if path == "/api/pemilu/calon":
            return self.pemilu_calon()
        if path == "/api/pemilu/pilih":
            return self.pemilu_pilih()
        if path == "/api/admin/pemilu/buka":
            return self.admin_pemilu("buka")
        if path == "/api/admin/pemilu/fase":
            return self.admin_pemilu("fase")
        if path == "/api/admin/pemilu/tutup":
            return self.admin_pemilu("tutup")
        if path == "/api/admin/pembangunan/bangun":
            return self.admin_pembangunan_bangun()
        if path == "/api/logout":
            auth = self.headers.get("Authorization") or ""
            if auth.startswith("Bearer "):
                with _db_lock, db() as conn:
                    conn.execute("DELETE FROM sesi WHERE token=%s", (auth[7:].strip(),))
            return self.kirim_json(200, {"ok": True})
        return self.kirim_json(404, {"error": "Tidak ditemukan"})

    def daftar(self):
        data = self.baca_json()
        if not data:
            return self.kirim_json(400, {"error": "Data tidak valid"})
        username = str(data.get("username") or "").strip().lstrip("@").lower()
        pin = str(data.get("pin") or "")
        baju = str(data.get("warna_baju") or "")
        kulit = str(data.get("warna_kulit") or "")
        topi = str(data.get("topi") or "tanpa")
        if not USERNAME_RE.match(username) or username.startswith(".") or username.endswith("."):
            return self.kirim_json(400, {"error": "Username Instagram tidak valid (huruf kecil, angka, titik, garis bawah)"})
        if not PIN_RE.match(pin):
            return self.kirim_json(400, {"error": "PIN harus 6 angka"})
        if not WARNA_RE.match(baju) or not WARNA_RE.match(kulit):
            return self.kirim_json(400, {"error": "Warna tidak valid"})
        if topi not in TOPI_SAH:
            return self.kirim_json(400, {"error": "Pilihan topi tidak valid"})
        salt = secrets.token_hex(16)
        pin_hash = hash_pin(pin, salt)
        with _db_lock, db() as conn:
            # Titik race alokasi: nomor rumah = COUNT(*)+1 dan penggabungan
            # keluarga harus atomik terhadap pendaftaran lain. _db_lock
            # menserialkan di dalam proses ini; advisory lock transaksi
            # menjaga hal yang sama antar-replika (lepas otomatis saat
            # transaksi commit/rollback). UNIQUE(nomor_rumah) adalah jaring
            # terakhir: tabrakan antar-replika tanpa lock akan gagal keras,
            # tidak pernah menghasilkan nomor ganda.
            conn.execute("SELECT pg_advisory_xact_lock(%s)", (KUNCI_ALOKASI,))
            ada = conn.execute("SELECT id FROM warga WHERE username=%s", (username,)).fetchone()
            if ada:
                return self.kirim_json(409, {"error": "Username sudah terdaftar. Silakan masuk dengan PIN kamu."})
            nomor = conn.execute("SELECT COUNT(*) c FROM warga").fetchone()["c"] + 1
            if nomor > KAPASITAS:
                return self.kirim_json(507, {"error": "Kavling kota sudah penuh (100.000 warga)"})
            blok, kavling, _, _ = alokasi(nomor)
            warga_id = conn.execute(
                "INSERT INTO warga(username,pin_hash,salt,warna_baju,warna_kulit,topi,nomor_rumah,blok,kavling) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (username, pin_hash, salt, baju, kulit, topi, nomor, blok, kavling),
            ).fetchone()["id"]
            token = secrets.token_hex(24)
            conn.execute("INSERT INTO sesi(token,warga_id) VALUES(%s,%s)", (token, warga_id))
            row = conn.execute("SELECT * FROM warga WHERE id=%s", (warga_id,)).fetchone()
            if not row["nik"]:  # NIK dibuat server sekali, saat pendaftaran
                conn.execute(
                    "UPDATE warga SET nik=%s WHERE id=%s",
                    (buat_nik(row["created_at"], row["nomor_rumah"]), row["id"]),
                )
                row = conn.execute("SELECT * FROM warga WHERE id=%s", (row["id"],)).fetchone()
            if not row["keluarga_id"]:  # warga baru langsung digabungkan ke keluarga (acak)
                gabung_keluarga(conn, row["id"])
                row = conn.execute("SELECT * FROM warga WHERE id=%s", (row["id"],)).fetchone()
        # Sambutan Pak Kades: HANYA di jalur pendaftaran baru ini (login
        # ulang tidak melewatinya) -> tepat satu pesan sambutan per warga.
        sambutan = sambutan_warga_baru(row)
        return self.kirim_json(201, {"ok": True, "token": token, "warga": warga_privat(row), "sambutan": sambutan})

    def login(self):
        data = self.baca_json()
        if not data:
            return self.kirim_json(400, {"error": "Data tidak valid"})
        username = str(data.get("username") or "").strip().lstrip("@").lower()
        pin = str(data.get("pin") or "")
        with _db_lock, db() as conn:
            row = conn.execute("SELECT * FROM warga WHERE username=%s", (username,)).fetchone()
            if not row or hash_pin(pin, row["salt"]) != row["pin_hash"]:
                return self.kirim_json(401, {"error": "Username atau PIN salah"})
            token = secrets.token_hex(24)
            conn.execute("INSERT INTO sesi(token,warga_id) VALUES(%s,%s)", (token, row["id"]))
        return self.kirim_json(200, {"ok": True, "token": token, "warga": warga_privat(row)})


if __name__ == "__main__":
    # Tunggu database siap (di Docker, healthcheck compose sudah menjaga
    # urutannya; pengulangan ini pengaman start manual/restart balapan).
    for _percobaan in range(15):
        try:
            init_db()
            break
        except psycopg.OperationalError:
            if _percobaan == 14:
                raise
            time.sleep(2)
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Desa Pinarak jalan di {HOST}:{PORT} (DB: PostgreSQL, kapasitas {KAPASITAS})", flush=True)
    srv.serve_forever()
