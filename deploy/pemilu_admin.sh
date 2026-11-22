#!/usr/bin/env bash
# Kendali Pemilu Desa Pinarak untuk admin (Pak Kades).
#
# Token admin dibaca dari ENV PINARAK_ADMIN_TOKEN — harus sama dengan env
# yang dipakai service `pinarak` di server. Nilai token TIDAK disimpan di
# berkas ini dan tidak dicetak.
#
# Pakai:
#   PINARAK_ADMIN_TOKEN=... ./pemilu_admin.sh buka        # buka periode (fase pencalonan)
#   PINARAK_ADMIN_TOKEN=... ./pemilu_admin.sh pemungutan  # pencalonan -> pemungutan suara
#   PINARAK_ADMIN_TOKEN=... ./pemilu_admin.sh tutup       # tutup + tetapkan pemenang
#
# Target default http://127.0.0.1:8026 (jalankan di X99); timpa dengan
# argumen kedua, mis. ./pemilu_admin.sh buka https://pinarak.mfah.me
set -euo pipefail

aksi="${1:-}"
base="${2:-http://127.0.0.1:8026}"

if [ -z "${PINARAK_ADMIN_TOKEN:-}" ]; then
  echo "ENV PINARAK_ADMIN_TOKEN belum diisi." >&2
  exit 2
fi

case "$aksi" in
  buka)
    curl -sS -X POST "$base/api/admin/pemilu/buka" \
      -H "X-Admin-Token: $PINARAK_ADMIN_TOKEN" ;;
  pemungutan)
    curl -sS -X POST "$base/api/admin/pemilu/fase" \
      -H "X-Admin-Token: $PINARAK_ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"fase":"pemungutan"}' ;;
  tutup)
    curl -sS -X POST "$base/api/admin/pemilu/tutup" \
      -H "X-Admin-Token: $PINARAK_ADMIN_TOKEN" ;;
  *)
    echo "Pakai: $0 buka|pemungutan|tutup [base_url]" >&2
    exit 2 ;;
esac
echo
