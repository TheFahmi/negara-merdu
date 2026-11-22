#!/bin/bash
# Regen VO Episode 2 v2: 18 warga + kas Rp440.000 (seg1-3). Profil e076e62d di X99.
set -a; . /root/builds/voicestudio/container.env; set +a
mkdir -p /root/ep2/vo2
cd /root/ep2/vo2
gen() {
  local n="$1" teks="$2"
  echo "=== seg${n} mulai $(date +%H:%M:%S) ==="
  curl -s -m 1200 -X POST -H "Authorization: Bearer $OMNIVOICE_API_KEY" \
    -F text="$teks" -F profile_id=e076e62d -F speed=1.0 -F language=Indonesian \
    -o "seg${n}.resp" http://127.0.0.1:3900/generate
  file "seg${n}.resp"
  head -c 4 "seg${n}.resp" | grep -q RIFF && mv "seg${n}.resp" "seg${n}.wav" || echo "seg${n} BUKAN WAV: $(head -c 200 seg${n}.resp)"
  echo "=== seg${n} selesai $(date +%H:%M:%S) ==="
}
gen 1 "Assalamu'alaikum, warga Negara Merdu! Pak Presiden menyapa kalian semua. Negara kita tumbuh, sekarang sudah delapan belas warga yang punya rumah di sini!"
gen 2 "Selamat datang untuk tujuh belas warga baru! Nama kalian sudah Pak Presiden absen di video ini. Coba cari, ada tidak namamu?"
gen 3 "Laporan kas negara: terkumpul empat puluh empat like dari semua postingan kita. Satu like nilainya sepuluh ribu rupiah, jadi kas negara sekarang empat ratus empat puluh ribu rupiah. Target pertama kita Taman, lima juta rupiah. Masih kurang empat juta lima ratus enam puluh ribu rupiah."
echo "VO V2 SELESAI"
ls -la
