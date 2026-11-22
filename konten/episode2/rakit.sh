#!/bin/bash
# Rakit Episode 2 Negara Merdu: blok frame per segmen -> concat -> overlay + VO.
# Durasi blok disetel ke durasi VO v2/v1 terukur. Total target +-65 dtk, 720x1280, 24fps.
set -e
cd ~/workspace/pinarak/konten/episode2
F=frames
O=overlay
V=voicestudio
mkdir -p rakit
# VO final: seg1-3 versi v2 (18 warga, kas 440rb), seg4-5 v1
cp $V/seg1v2.wav rakit/vo1.wav
cp $V/seg2v2.wav rakit/vo2.wav
cp $V/seg3v2.wav rakit/vo3.wav
cp $V/seg4.wav   rakit/vo4.wav
cp $V/seg5.wav   rakit/vo5.wav

blok() { # nama pola fps
  ffmpeg -y -v error -framerate "$3" -i "$F/$2_%04d.jpg" \
    -vf "scale=720:1280,fps=24,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 "rakit/$1.mp4"
}
# B1 e1 130f/8.8s | B2 k1+k2 digabung manual di bawah | B3 e2 130f/11.8s
blok b1 e1 14.77 130
blok b3 e2 11.20 130
blok b4 f5 6.63 110
blok b5 e4 10.90 130
blok b6 e6 12.05 100
# B2: k1 (100f) + k2 (60f) pada fps sama 19.28 -> dua file lalu gabung
blok b2a k1 10.84 70
blok b2b k2 10.84 20
printf "file 'b2a.mp4'\nfile 'b2b.mp4'\n" > rakit/list_b2.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_b2.txt -c copy rakit/b2.mp4
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\nfile 'b5.mp4'\nfile 'b6.mp4'\n" > rakit/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_all.txt -c copy rakit/video.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 rakit/video.mp4

# Overlay + audio dalam satu pass. Peta waktu absolut (dtk):
# B1 0-8.8 | B2 8.8-17.1 | B3 17.1-28.9 | B4 28.9-45.5 | B5 45.5-57.4 | B6 57.4-65.7
ffmpeg -y -v error -i rakit/video.mp4 \
  -i $O/o1_judul.png -i $O/o2_sapa.png -i $O/o3_absen_judul.png \
  -i $O/o4_absen_a.png -i $O/o5_absen_b.png -i $O/o6_absen_c.png \
  -i $O/o7_absen_d.png -i $O/o11_absen_e.png -i $O/o8_kas.png \
  -i $O/o9_bangun.png -i $O/o10_penutup.png \
  -i rakit/vo1.wav -i rakit/vo2.wav -i rakit/vo3.wav -i rakit/vo4.wav -i rakit/vo5.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,4.3)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,9.4,13.4)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,17.4,19.2)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,19.2,21.15)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,21.15,23.1)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,23.1,25.05)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,25.05,27.0)'[v7];\
[v7][8:v]overlay=0:0:enable='between(t,27.0,28.9)'[v8];\
[v8][9:v]overlay=0:0:enable='between(t,30.5,44.5)'[v9];\
[v9][10:v]overlay=0:0:enable='between(t,46.1,52.5)'[v10];\
[v10][11:v]overlay=0:0:enable='between(t,58.6,65.4)'[v11];\
[v11]fade=t=out:st=65.1:d=0.6,format=yuv420p[vout];\
[12:a]adelay=300:all=1[a1];\
[13:a]adelay=9100:all=1[a2];\
[14:a]adelay=29200:all=1[a3];\
[15:a]adelay=45800:all=1[a4];\
[16:a]adelay=57700:all=1[a5];\
[a1][a2][a3][a4][a5]amix=inputs=5:normalize=0,afade=t=out:st=65.1:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -shortest episode2_vs.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 episode2_vs.mp4
echo RAKIT_SELESAI
