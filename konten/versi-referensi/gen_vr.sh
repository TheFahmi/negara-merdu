#!/bin/bash
# Gen VO Versi Referensi Negara Merdu. Profil e076e62d (Narator Pinarak)
# di X99, satu take kontinu per segmen.
set -a; . /root/builds/voicestudio/container.env; set +a
mkdir -p /root/vr/vo
cd /root/vr/vo
gen() {
  local n="$1" teks="$2"
  echo "=== seg${n} mulai $(date +%H:%M:%S) ==="
  curl -s -m 1200 -X POST -H "Authorization: Bearer $OMNIVOICE_API_KEY" \
    -F text="$teks" -F profile_id=e076e62d -F speed=1.0 -F language=Indonesian \
    -o "seg${n}.resp" http://127.0.0.1:3900/generate
  head -c 4 "seg${n}.resp" | grep -q RIFF && mv "seg${n}.resp" "seg${n}.wav" || echo "seg${n} BUKAN WAV: $(head -c 200 seg${n}.resp)"
  echo "=== seg${n} selesai $(date +%H:%M:%S) ==="
}
gen 1 "Ini Negara Merdu — negara 3D yang hidup di browser kamu. Penduduknya bukan NPC. Mereka orang asli: 47 warga, masing-masing punya rumah, KTP, dan Kartu Keluarga."
gen 2 "Setiap warga yang daftar langsung dapat rumah di kavlingnya sendiri. Ada jalan raya, lampu merah, bus Trans Merdu, sampai KRL yang bisa kamu naiki."
gen 3 "Rumahnya bisa dimasuki. Di dalam game kamu bisa ngobrol sesama warga, ikut pemilu, dan mengusulkan pembangunan. Masjid, taman, dan toko pancing ini semua usulan warga."
gen 4 "Kas negaranya asli dari engagement kalian: tujuh juta seratus sembilan puluh ribu rupiah, terkumpul dari like dan share. Mau jadi warga? Komentar RUMAH di postingan ini — rumahmu langsung dibangun. Gratis, tanpa download, main di merdu.id. Yang follow bukan penonton — tapi warga."
echo "VO VR SELESAI"
for f in seg*.wav; do echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null || echo "?"; done
ls -la
