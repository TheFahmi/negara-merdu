#!/bin/bash
# Rakit ulang drama masjid — HANYA suara Presiden diganti (satu take kontinu).
# Blok video TIDAK diubah (pakai ulang rakit/video.mp4 dari rakit.sh).
# Penempatan baru: pres1 @26.2 (12,0 dtk) | pres2 @38.9 (2,78 dtk) | dren2 @42.4 tetap.
set -e
cd ~/workspace/pinarak/konten/drama-masjid
F=frames; O=overlay; V=voicestudio
[ -f drama_masjid_vs_v1suara.mp4 ] || cp drama_masjid_vs.mp4 drama_masjid_vs_v1suara.mp4
ffmpeg -y -v error -i rakit/video.mp4 \
  -i $O/o1_judul.png -i $O/o2_nar1.png -i $O/o3_hana.png -i $O/o4_dren1.png -i $O/o5_taa.png \
  -i $O/o6_pres1.png -i $O/o7_pres2.png -i $O/o8_dren2.png -i $O/o9_nar2.png -i $O/o10_penutup.png \
  -i $V/nar1.wav -i $V/hana1.wav -i $V/dren1.wav -i $V/taa1.wav \
  -i $V/pres1.wav -i $V/pres2.wav -i $V/dren2.wav -i $V/nar2.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,5.2)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,0.4,8.2)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,13.5,17.3)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,17.8,20.6)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,21.1,24.7)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,26.2,38.35)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,38.9,41.85)'[v7];\
[v7][8:v]overlay=0:0:enable='between(t,42.4,44.1)'[v8];\
[v8][9:v]overlay=0:0:enable='between(t,45.2,55.5)'[v9];\
[v9][10:v]overlay=0:0:enable='between(t,55.6,59.2)'[v10];\
[v10]fade=t=out:st=58.9:d=0.6,format=yuv420p[vout];\
[11:a]adelay=400:all=1[a1];\
[12:a]adelay=13500:all=1[a2];\
[13:a]adelay=17800:all=1[a3];\
[14:a]adelay=21100:all=1[a4];\
[15:a]adelay=26200:all=1[a5];\
[16:a]adelay=38900:all=1[a6];\
[17:a]adelay=42400:all=1[a7];\
[18:a]adelay=45200:all=1[a8];\
[a1][a2][a3][a4][a5][a6][a7][a8]amix=inputs=8:normalize=0,apad=whole_dur=59.5,afade=t=out:st=58.9:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 59.5 drama_masjid_vs_baru.mp4
mv drama_masjid_vs_baru.mp4 drama_masjid_vs.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 drama_masjid_vs.mp4
echo RAKIT_FIX_SELESAI
