#!/bin/bash
# Rakit Drama Transportasi "Hari Pertama Trans Merdu" — capture ALIENWARE (RTX 3070 Ti).
# Resample nearest-timestamp 24fps (duplikasi murni). TANPA minterpolate, TANPA setpts.
# VO satu take per segmen (Narator Pinarak e076e62d, semua peran); tanpa atempo.
# Blok: B1 6.5 | B2 9.5 | B3 9.5 | B4 7.5 | B5 7.5 | B6 8.5 | B7 6.0 | B8 7.5 | B9 8.5 = 71.0 dtk.
set -e
cd ~/workspace/pinarak/konten/drama-transportasi
F=frames8r
O=overlay
V=voicestudio
mkdir -p rakit
for n in 1 2 3 4 5 6 7; do cp $V/seg$n.wav rakit/vo$n.wav; done
for f in rakit/vo*.wav; do echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"; done

blok() {
  ffmpeg -y -v error -framerate 24 -i "$F/$2_r_%04d.jpg" \
    -vf "scale=720:1280,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 "rakit/$1.mp4"
}
blok b1 b1
blok b2 b2
blok b3 b3
blok b4 b4
blok b5 b5
blok b6 b6
blok b7 b7
blok b8 b8
blok b9 b9
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\nfile 'b5.mp4'\nfile 'b6.mp4'\nfile 'b7.mp4'\nfile 'b8.mp4'\nfile 'b9.mp4'\n" > rakit/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_all.txt -c copy rakit/video.mp4
echo -n "video gabungan: "; ffprobe -v error -show_entries format=duration -of csv=p=0 rakit/video.mp4

# Peta waktu: B1 0-6.5 | B2 6.5-16 | B3 16-25.5 | B4 25.5-33 | B5 33-40.5 | B6 40.5-49 | B7 49-55 | B8 55-62.5 | B9 62.5-71
# VO: vo1 @0.35 | vo2 @6.85 | vo3 @16.35 | vo4 @27.5 | vo5 @40.85 | vo6 @55.35 | vo7 @62.85
ffmpeg -y -v error -i rakit/video.mp4 \
  -i $O/o1_judul.png -i $O/o_lab_presiden.png -i $O/o_lab_halte.png -i $O/o_lab_jr.png \
  -i $O/o_lab_bus.png -i $O/o_lab_lampu.png -i $O/o_lab_stasiun.png -i $O/o_lab_dalamkrl.png \
  -i $O/o_lab_utara.png -i $O/o9_penutup.png \
  -i rakit/vo1.wav -i rakit/vo2.wav -i rakit/vo3.wav -i rakit/vo4.wav -i rakit/vo5.wav -i rakit/vo6.wav -i rakit/vo7.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,4.2)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,6.6,15.9)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,16.1,19.2)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,19.2,25.4)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,25.6,32.9)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,33.1,40.4)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,40.6,48.9)'[v7];\
[v7][8:v]overlay=0:0:enable='between(t,49.1,54.9)'[v8];\
[v8][9:v]overlay=0:0:enable='between(t,55.1,62.4)'[v9];\
[v9][10:v]overlay=0:0:enable='between(t,66.5,70.7)'[v10];\
[v10]fade=t=out:st=70.4:d=0.6,format=yuv420p[vout];\
[11:a]adelay=350:all=1[a1];\
[12:a]adelay=6850:all=1[a2];\
[13:a]adelay=16350:all=1[a3];\
[14:a]adelay=27500:all=1[a4];\
[15:a]adelay=40850:all=1[a5];\
[16:a]adelay=55350:all=1[a6];\
[17:a]adelay=62850:all=1[a7];\
[a1][a2][a3][a4][a5][a6][a7]amix=inputs=7:normalize=0,apad=whole_dur=71,afade=t=out:st=70.4:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 71 drama_transportasi.mp4
ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name -show_entries format=duration,size -of default=noprint_wrappers=1 drama_transportasi.mp4
echo RAKIT8_SELESAI
