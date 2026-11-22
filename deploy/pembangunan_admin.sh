#!/usr/bin/env bash
# Kendali Pembangunan Desa Pinarak untuk admin (Pak Kades).
#
# Fasilitas desa dibangun satu per satu dari usulan warga di komentar
# Instagram; perintah `bangun` di sini adalah titik keputusan Pak Kades
# masuk ke desa (klien membaca statusnya saat halaman dimuat).
#
# Token admin dibaca dari ENV PINARAK_ADMIN_TOKEN — harus sama dengan env
# yang dipakai service `pinarak` di server. Nilai token TIDAK disimpan di
# berkas ini dan tidak dicetak.
#
# Pakai:
#   PINARAK_ADMIN_TOKEN=... ./pembangunan_admin.sh bangun taman   # tandai Taman Desa terbangun
#   ./pembangunan_admin.sh daftar                                 # lihat status semua fasilitas
#
# Kunci fasilitas: taman, lapangan, perpustakaan, balai_warga, sekolah,
# puskesmas, pasar, masjid.
#
# Target default http://127.0.0.1:8026 (jalankan di X99); timpa dengan
# argumen terakhir, mis. ./pembangunan_admin.sh bangun taman https://pinarak.mfah.me
set -euo pipefail

aksi="${1:-}"

case "$aksi" in
  bangun)
    kunci="${2:-}"
    base="${3:-http://127.0.0.1:8026}"
    if [ -z "$kunci" ]; then
      echo "Pakai: $0 bangun <kunci> [base_url]" >&2
      exit 2
    fi
    if [ -z "${PINARAK_ADMIN_TOKEN:-}" ]; then
      echo "ENV PINARAK_ADMIN_TOKEN belum diisi." >&2
      exit 2
    fi
    curl -sS -X POST "$base/api/admin/pembangunan/bangun" \
      -H "X-Admin-Token: $PINARAK_ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"kunci\":\"$kunci\"}" ;;
  daftar)
    base="${2:-http://127.0.0.1:8026}"
    curl -sS "$base/api/pembangunan" ;;
  *)
    echo "Pakai: $0 bangun <kunci>|daftar [base_url]" >&2
    exit 2 ;;
esac
echo
