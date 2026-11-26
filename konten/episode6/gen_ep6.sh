#!/bin/bash
# Gen VO Episode 6 Negara Merdu. Profil e076e62d (Narator Pinarak) di X99, satu take per segmen.
set -a; . /root/builds/voicestudio/container.env; set +a
mkdir -p /root/ep6/vo
cd /root/ep6/vo
gen() {
  local n="$1" teks="$2"
  echo "=== seg${n} mulai $(date +%H:%M:%S) ==="
  curl -s -m 1200 -X POST -H "Authorization: Bearer $OMNIVOICE_API_KEY" \
    -F text="$teks" -F profile_id=e076e62d -F speed=1.0 -F language=Indonesian \
    -o "seg${n}.resp" http://127.0.0.1:3900/generate
  head -c 4 "seg${n}.resp" | grep -q RIFF && mv "seg${n}.resp" "seg${n}.wav" || echo "seg${n} BUKAN WAV: $(head -c 200 seg${n}.resp)"
  echo "=== seg${n} selesai $(date +%H:%M:%S) ==="
}
gen 1 "Assalamu'alaikum, warga Negara Merdu! Episode keenam: negara kita makin ramai — empat puluh enam warga!"
gen 2 "Selamat datang, warga baru! Nomor empat puluh satu: eka_catherine_, Rumah Nomor 41, Blok 1881 Kavling 16. Nomor empat puluh dua: ramadaniferlita, Kavling 17. Nomor empat puluh tiga: dubaicwikuki4life, Kavling 18."
gen 3 "Nomor empat puluh empat: asila_cill, Kavling 19. Nomor empat puluh lima: xyjr.naaa, Kavling 20. Dan warga keempat puluh enam: pricilliady, Kavling 21. Blok 1881 tinggal empat kavling lagi menuju penuh!"
gen 4 "Laporan kas negara: seratus tiga belas like terkumpul dari semua postingan. Kas sekarang dua juta seratus tiga puluh ribu rupiah. Target besar kita tetap: Apartemen Merdu Residence di Blok 2120, lima puluh juta rupiah. Setiap like dari kamu bernilai sepuluh ribu rupiah untuk kas negara."
gen 5 "Usulan yang masih antre: Kopdes dari Aldi Saputra, dan Mall dari 4caa_caaaee. Like usulan favoritmu, atau tulis usulanmu sendiri di komentar. Usulan dengan like terbanyak dibangun duluan — dan pengusulnya jadi owner-nya!"
gen 6 "Menuju seratus warga: di warga keseratus, akan ada Perayaan Seratus Warga di negara ini. Pemilu dibuka di sepuluh ribu warga. Yang follow bukan penonton — tapi warga. Daftar di merdu.id, dapat rumah, KTP, dan Kartu Keluarga!"
echo "VO EP6 SELESAI"
for f in seg*.wav; do echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null || echo "?"; done
ls -la
