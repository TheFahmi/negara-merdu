#!/bin/bash
# Rakit ULANG Episode 5 (vs2): frame capture baru (ep5_capture3.py, renderer pinjaman).
# ATURAN GERAK BARU: TANPA minterpolate, TANPA setpts/perlambatan global.
# Konversi ke 24fps murni duplikasi frame (fps filter). VO = file rakit/vo*.wav
# yang sama (sudah atempo dari produksi vs1). Peta overlay persis rakit_final.sh.
set -e
cd ~/workspace/pinarak/konten/episode5
F=frames2
O=overlay
mkdir -p rakit2

blok() { # nama segmen framerate durasi
  ffmpeg -y -v error -framerate "$3" -i "$F/$2_%04d.jpg" \
    -vf "fps=24,format=yuv420p" -t "$4" \
    -c:v libx264 -preset medium -crf 19 "rakit2/$1.mp4"
  echo -n "$1 durasi: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "rakit2/$1.mp4"
}
# B1 d1 12f/6.2s | B2 a1 30f/15.6s | B3 a2 24f/12.6s
# B4 k1 32f/19.2s | B5 v1 18f/12.2s | B6 p1 18f/11.9s  (total 77.7s)
blok b1 d1 1.935484 6.2
blok b2 a1 1.923077 15.6
blok b3 a2 1.904762 12.6
blok b4 k1 1.666667 19.2
blok b5 v1 1.475410 12.2
blok b6 p1 1.512605 11.9
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\nfile 'b5.mp4'\nfile 'b6.mp4'\n" > rakit2/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit2/list_all.txt -c copy rakit2/video.mp4
echo -n "video gabungan: "; ffprobe -v error -show_entries format=duration -of csv=p=0 rakit2/video.mp4

# Peta waktu (dtk): B1 0-6.2 | B2 6.2-21.8 | B3 21.8-34.4 | B4 34.4-53.6 | B5 53.6-65.8 | B6 65.8-77.7
# VO: vo1 @0.3 | vo2 @6.5 | vo3 @22.35 | vo4 @34.95 | vo5 @54.73 | vo6 @66.5
ffmpeg -y -v error -i rakit2/video.mp4 \
  -i $O/o1_judul.png -i $O/o2_absen_judul.png -i $O/o3_absen1.png -i $O/o4_absen2.png \
  -i $O/o5_kas.png -i $O/o6_voting.png -i $O/o7_penutup.png \
  -i rakit/vo1.wav -i rakit/vo2.wav -i rakit/vo3.wav -i rakit/vo4.wav -i rakit/vo5.wav -i rakit/vo6.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,6.0)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,6.3,9.5)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,9.0,21.8)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,22.3,34.4)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,35.6,54.2)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,55.2,66.1)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,67.0,77.4)'[v7];\
[v7]fade=t=out:st=77.1:d=0.6,format=yuv420p[vout];\
[8:a]adelay=300:all=1[a1];\
[9:a]adelay=6500:all=1[a2];\
[10:a]adelay=22350:all=1[a3];\
[11:a]adelay=34950:all=1[a4];\
[12:a]adelay=54730:all=1[a5];\
[13:a]adelay=66500:all=1[a6];\
[a1][a2][a3][a4][a5][a6]amix=inputs=6:normalize=0,apad=whole_dur=77.7,afade=t=out:st=77.1:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 77.7 episode5_vs2.mp4
ffprobe -v error -show_entries stream=width,height,r_frame_rate -show_entries format=duration,size -of default=noprint_wrappers=1 episode5_vs2.mp4
echo RAKIT2_SELESAI
