#!/bin/bash
# Gen VO Drama Transportasi "Hari Pertama Trans Merdu". Profil e076e62d (Narator Pinarak)
# di X99, satu take kontinu per segmen/peran. Presiden = profil yang sama.
set -a; . /root/builds/voicestudio/container.env; set +a
mkdir -p /root/dt/vo
cd /root/dt/vo
gen() {
  local n="$1" teks="$2"
  echo "=== seg${n} mulai $(date +%H:%M:%S) ==="
  curl -s -m 1200 -X POST -H "Authorization: Bearer $OMNIVOICE_API_KEY" \
    -F text="$teks" -F profile_id=e076e62d -F speed=1.0 -F language=Indonesian \
    -o "seg${n}.resp" http://127.0.0.1:3900/generate
  head -c 4 "seg${n}.resp" | grep -q RIFF && mv "seg${n}.resp" "seg${n}.wav" || echo "seg${n} BUKAN WAV: $(head -c 200 seg${n}.resp)"
  echo "=== seg${n} selesai $(date +%H:%M:%S) ==="
}
gen 1 "Pagi yang cerah di Negara Merdu. Hari ini hari yang ditunggu-tunggu: hari pertama bus Trans Merdu dan KRL Merdu resmi beroperasi untuk warga!"
gen 2 "Mulai hari ini, tidak ada lagi jalan kaki keliling negara. Sembilan bus dan KRL kita siap mengantar warga sampai tujuan. Ini transportasi negara — untuk warga."
gen 3 "Aduh, aku telat bangun! Busnya sudah lewat belum, ya? Itu dia datang! Untung pintunya masih terbuka — aku ikut!"
gen 4 "Pintu membuka, warga yang mengantre naik satu per satu. Bus pun melaju tertib — lampu merah, berhenti dulu."
gen 5 "Turun di sini, ganti KRL ke Merdu Utara. Itu dia keretanya datang! Di dalamnya bisa jalan di lorong — pindah gerbong juga bisa."
gen 6 "Selamat datang di Stasiun Merdu Utara. Cepat dan nyaman, kan? Begitulah transportasi di negara kita."
gen 7 "Hari pertama Trans Merdu berjalan lancar. Besok, giliranmu yang naik. Yang follow bukan penonton — tapi warga. Daftar di merdu.id!"
echo "VO DT SELESAI"
for f in seg*.wav; do echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null || echo "?"; done
ls -la
