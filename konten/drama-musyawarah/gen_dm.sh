#!/bin/bash
# Gen VO Drama Musyawarah "Kopdes atau Mall?". Profil e076e62d (Narator Pinarak)
# di X99, satu take kontinu per segmen/peran. Presiden = profil yang sama.
set -a; . /root/builds/voicestudio/container.env; set +a
mkdir -p /root/dm/vo
cd /root/dm/vo
gen() {
  local n="$1" teks="$2"
  echo "=== seg${n} mulai $(date +%H:%M:%S) ==="
  curl -s -m 1200 -X POST -H "Authorization: Bearer $OMNIVOICE_API_KEY" \
    -F text="$teks" -F profile_id=e076e62d -F speed=1.0 -F language=Indonesian \
    -o "seg${n}.resp" http://127.0.0.1:3900/generate
  head -c 4 "seg${n}.resp" | grep -q RIFF && mv "seg${n}.resp" "seg${n}.wav" || echo "seg${n} BUKAN WAV: $(head -c 200 seg${n}.resp)"
  echo "=== seg${n} selesai $(date +%H:%M:%S) ==="
}
gen 1 "Warga Negara Merdu, mari bermusyawarah. Kas negara kita saat ini dua juta seratus tiga puluh ribu rupiah. Ada dua usulan pembangunan yang sedang antre. Malam ini, kita dengar keduanya."
gen 2 "Usulan pertama: Koperasi Desa, diusulkan Aldi Saputra. Lahannya sudah disiapkan di Blok 997. Warga bisa belanja kebutuhan dan simpan-pinjam di koperasi milik bersama — untungnya kembali ke warga."
gen 3 "Usulan kedua: Merdu Mall, diusulkan lewat komentar Episode 2. Lahannya di Blok 2917, di selatan negara. Pusat belanja sekaligus tempat nongkrong warga, kata pengusulnya."
gen 4 "Aku dukung koperasi! Belanja dekat rumah, harga untuk warga, untungnya juga balik ke warga."
gen 5 "Kalau aku tetap tim mall! Negara ini butuh tempat nongkrong yang seru. Belanja bisa, santai juga bisa."
gen 6 "Musyawarah selesai. Keputusannya di tangan warga: voting dibuka di komentar video ini. Tulis KOPDES, atau MALL. Dukungan terbanyak, itulah yang dibangun duluan — dan pengusulnya jadi pemiliknya. Yang follow bukan penonton, tapi warga!"
echo "VO DM SELESAI"
for f in seg*.wav; do echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null || echo "?"; done
ls -la
