#!/bin/bash
# Gen VO Kenalan Transportasi Negara Merdu. Profil e076e62d (Narator Pinarak) di X99, satu take per segmen.
set -a; . /root/builds/voicestudio/container.env; set +a
mkdir -p /root/kt/vo
cd /root/kt/vo
gen() {
  local n="$1" teks="$2"
  echo "=== seg${n} mulai $(date +%H:%M:%S) ==="
  curl -s -m 1200 -X POST -H "Authorization: Bearer $OMNIVOICE_API_KEY" \
    -F text="$teks" -F profile_id=e076e62d -F speed=1.0 -F language=Indonesian \
    -o "seg${n}.resp" http://127.0.0.1:3900/generate
  head -c 4 "seg${n}.resp" | grep -q RIFF && mv "seg${n}.resp" "seg${n}.wav" || echo "seg${n} BUKAN WAV: $(head -c 200 seg${n}.resp)"
  echo "=== seg${n} selesai $(date +%H:%M:%S) ==="
}
gen 1 "Assalamu'alaikum, warga Negara Merdu! Hari ini kita kenalan dengan transportasi negara kita: bus Trans Merdu dan KRL Merdu!"
gen 2 "Ini bus Trans Merdu. Sembilan bus melayani tiga rute: Koridor Satu keliling kota, dan Koridor Dua lewat Plaza dan Istana. Di setiap halte bus berhenti, pintunya membuka — warga yang menunggu naik, bus pun jalan lagi."
gen 3 "Di dalam bus ada deretan kursi dan tiang pegangan untuk berdiri. Duduk yang rapi ya — dari jendela, kamu bisa lihat kota kita lewat."
gen 4 "Sama seperti kendaraan lain di Negara Merdu, bus Trans Merdu patuh lampu lalu lintas. Lampu merah berhenti, lampu hijau jalan lagi."
gen 5 "Kalau yang ini, KRL Merdu! Kereta layang keliling kota: empat rangkaian, dua arah berlawanan. KRL berhenti di Stasiun Merdu dan Stasiun Merdu Utara — empat belas detik di tiap stasiun, cukup untuk naik dan turun."
gen 6 "Kamu juga bisa naik beneran! Datang ke halte atau stasiun, tunggu kendaraannya berhenti, lalu tekan tombol Naik. Di dalam, jalan saja di lorongnya — turun lagi saat kendaraan berhenti di halte atau stasiun berikutnya."
gen 7 "Jadi tidak perlu jalan kaki keliling negara — naik bus atau KRL saja. Yang follow bukan penonton — tapi warga. Daftar di merdu.id!"
echo "VO KT SELESAI"
for f in seg*.wav; do echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null || echo "?"; done
ls -la
