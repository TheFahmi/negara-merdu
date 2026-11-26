#!/bin/bash
# Rakit Episode 6 Negara Merdu — capture ALIENWARE (GPU), resep Ep5 vs3.
# Frame unik rapat, resample nearest-timestamp ke 24fps (duplikasi murni).
# TANPA minterpolate, TANPA setpts. VO satu take per segmen (profil e076e62d);
# atempo hanya di audio: seg3 1.10, seg5 1.05, seg6 1.05 (maks ±1,15).
# Blok: B1 6.2 | B2 15.6 | B3 14.6 | B4 19.2 | B5 12.2 | B6 12.2 = 80.0 dtk.
set -e
cd ~/workspace/pinarak/konten/episode6
F=frames6r
O=overlay
V=voicestudio
mkdir -p rakit
cp $V/seg1.wav rakit/vo1.wav
cp $V/seg2.wav rakit/vo2.wav
ffmpeg -y -v error -i $V/seg3.wav -af atempo=1.10 rakit/vo3.wav
cp $V/seg4.wav rakit/vo4.wav
ffmpeg -y -v error -i $V/seg5.wav -af atempo=1.05 rakit/vo5.wav
ffmpeg -y -v error -i $V/seg6.wav -af atempo=1.05 rakit/vo6.wav
for f in rakit/vo*.wav; do echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"; done

blok() { # nama pola
  ffmpeg -y -v error -framerate 24 -i "$F/$2_r_%04d.jpg" \
    -vf "scale=720:1280,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 "rakit/$1.mp4"
}
blok b1 d1
blok b2 a1
blok b3 a2
blok b4 k1
blok b5 v1
blok b6 p1
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\nfile 'b5.mp4'\nfile 'b6.mp4'\n" > rakit/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_all.txt -c copy rakit/video.mp4
echo -n "video gabungan: "; ffprobe -v error -show_entries format=duration -of csv=p=0 rakit/video.mp4

# Peta waktu (dtk): B1 0-6.2 | B2 6.2-21.8 | B3 21.8-36.4 | B4 36.4-55.6 | B5 55.6-67.8 | B6 67.8-80.0
# VO: vo1 @0.3 | vo2 @6.5 | vo3 @22.1 | vo4 @36.7 | vo5 @55.9 | vo6 @68.1
ffmpeg -y -v error -i rakit/video.mp4 \
  -i $O/o1_judul.png -i $O/o2_absen_judul.png -i $O/o3_absen1.png -i $O/o4_absen2.png \
  -i $O/o5_kas.png -i $O/o6_voting.png -i $O/o7_penutup.png \
  -i rakit/vo1.wav -i rakit/vo2.wav -i rakit/vo3.wav -i rakit/vo4.wav -i rakit/vo5.wav -i rakit/vo6.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,6.0)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,6.3,9.5)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,9.0,21.8)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,22.3,36.4)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,37.4,55.4)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,56.6,67.6)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,68.8,79.7)'[v7];\
[v7]fade=t=out:st=79.4:d=0.6,format=yuv420p[vout];\
[8:a]adelay=300:all=1[a1];\
[9:a]adelay=6500:all=1[a2];\
[10:a]adelay=22100:all=1[a3];\
[11:a]adelay=36700:all=1[a4];\
[12:a]adelay=55900:all=1[a5];\
[13:a]adelay=68100:all=1[a6];\
[a1][a2][a3][a4][a5][a6]amix=inputs=6:normalize=0,apad=whole_dur=80,afade=t=out:st=79.4:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 80 episode6_vs.mp4
ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name -show_entries format=duration,size -of default=noprint_wrappers=1 episode6_vs.mp4
echo RAKIT6_SELESAI
