#!/bin/bash
# Generate VO Episode 2 Negara Merdu di VoiceStudio X99 (CPU), profil Narator Pinarak (e076e62d).
set -a; . /root/builds/voicestudio/container.env; set +a
mkdir -p /root/ep2/vo
cd /root/ep2/vo
gen() {
  local n="$1" teks="$2"
  if [ -s "seg${n}.wav" ]; then echo "seg${n} sudah ada, lewati"; return; fi
  echo "=== seg${n} mulai $(date +%H:%M:%S) ==="
  curl -s -m 1200 -X POST -H "Authorization: Bearer $OMNIVOICE_API_KEY" \
    -F text="$teks" -F profile_id=e076e62d -F speed=1.0 -F language=Indonesian \
    -o "seg${n}.resp" http://127.0.0.1:3900/generate
  file "seg${n}.resp"
  head -c 4 "seg${n}.resp" | grep -q RIFF && mv "seg${n}.resp" "seg${n}.wav" || echo "seg${n} BUKAN WAV: $(head -c 200 seg${n}.resp)"
  echo "=== seg${n} selesai $(date +%H:%M:%S) ==="
}
gen 1 "Assalamu'alaikum, warga Negara Merdu! Pak Presiden menyapa kalian semua. Negara kita tumbuh, sekarang sudah lima belas warga yang punya rumah di sini!"
gen 2 "Selamat datang untuk empat belas warga baru! Nama kalian sudah Pak Presiden absen di video ini. Coba cari, ada tidak namamu?"
gen 3 "Laporan kas negara: terkumpul empat puluh tiga like dari semua postingan kita. Satu like nilainya sepuluh ribu rupiah, jadi kas negara sekarang empat ratus tiga puluh ribu rupiah. Target pertama kita Taman, lima juta rupiah. Masih kurang empat juta lima ratus tujuh puluh ribu rupiah."
gen 4 "Nah, sekarang Pak Presiden tanya: kita mau bangun apa dulu? Tulis usulanmu di komentar, usulan dengan like terbanyak dibangun duluan, dan kamu jadi pemiliknya. Ingat, kas negara dipakai untuk membangun."
gen 5 "Ayo ramaikan! Follow akun ini, dan daftar di merdu dot id, dapat rumah, KTP, dan Kartu Keluarga. Sampai jumpa di episode berikutnya!"
echo "SEMUA VO SELESAI"
ls -la
