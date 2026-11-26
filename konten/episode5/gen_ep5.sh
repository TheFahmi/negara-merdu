#!/bin/bash
# Gen VO Episode 5 Negara Merdu. Profil e076e62d (Narator Pinarak) di X99, satu take per segmen.
set -a; . /root/builds/voicestudio/container.env; set +a
mkdir -p /root/ep5/vo
cd /root/ep5/vo
gen() {
  local n="$1" teks="$2"
  echo "=== seg${n} mulai $(date +%H:%M:%S) ==="
  curl -s -m 1200 -X POST -H "Authorization: Bearer $OMNIVOICE_API_KEY" \
    -F text="$teks" -F profile_id=e076e62d -F speed=1.0 -F language=Indonesian \
    -o "seg${n}.resp" http://127.0.0.1:3900/generate
  head -c 4 "seg${n}.resp" | grep -q RIFF && mv "seg${n}.resp" "seg${n}.wav" || echo "seg${n} BUKAN WAV: $(head -c 200 seg${n}.resp)"
  echo "=== seg${n} selesai $(date +%H:%M:%S) ==="
}
gen 1 "Assalamu'alaikum, warga Negara Merdu! Episode kelima: negara kita resmi tembus empat puluh warga!"
gen 2 "Selamat datang, warga baru! Nomor tiga puluh lima: keylaint_, Rumah Nomor 35, Blok 1881 Kavling 10. Nomor tiga puluh enam: kayu_papang, Kavling 11. Nomor tiga puluh tujuh: modhasyraff_23, Kavling 12 — yang kemarin siap jadi marbot masjid kita!"
gen 3 "Nomor tiga puluh delapan: x06, Kavling 13. Nomor tiga puluh sembilan: dipawww48, Kavling 14. Dan warga keempat puluh: adifa, Kavling 15. Blok 1881 makin penuh, tetangga kalian makin ramai!"
gen 4 "Pekan ini masjid kita resmi dibuka — drama peresmiannya sudah tayang. Teaser Apartemen Merdu Residence juga sudah bisa ditonton. Laporan kas negara: sembilan puluh tujuh like terkumpul dari semua postingan. Kas sekarang satu juta sembilan ratus tujuh puluh ribu rupiah. Target besar kita: Apartemen di Blok 2120, lima puluh juta rupiah."
gen 5 "Usulan yang masih antre: Kopdes dari Aldi Saputra, dan Mall dari 4caa_caaaee. Like usulan favoritmu, atau tulis usulanmu sendiri di komentar. Usulan dengan like terbanyak, itu yang dibangun duluan — dan pengusulnya jadi owner-nya!"
gen 6 "Menuju seratus warga: di warga keseratus, akan ada Perayaan Seratus Warga di negara ini. Pemilu dibuka di sepuluh ribu warga. Yang follow bukan penonton — tapi warga. Daftar di merdu.id, dapat rumah, KTP, dan Kartu Keluarga!"
echo "VO EP5 SELESAI"
for f in seg*.wav; do echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null || echo "?"; done
ls -la
