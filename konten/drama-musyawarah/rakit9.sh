#!/bin/bash
# Rakit Drama Musyawarah "Kopdes atau Mall?" — capture ALIENWARE (RTX 3070 Ti).
# Resample nearest-timestamp 24fps (duplikasi murni). TANPA minterpolate, TANPA setpts.
# VO satu take per segmen (Narator Pinarak e076e62d, semua peran); tanpa atempo.
# Blok: B1 11.5 | B2 13.5 | B3 11.5 | B4 6.5 | B5 7.0 | B6 15.0 = 65.0 dtk.
set -e
cd ~/workspace/pinarak/konten/drama-musyawarah
F=frames9r
O=overlay
V=voicestudio
mkdir -p rakit
for n in 1 2 3 4 5 6; do cp $V/seg$n.wav rakit/vo$n.wav; done
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
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\nfile 'b5.mp4'\nfile 'b6.mp4'\n" > rakit/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_all.txt -c copy rakit/video.mp4
echo -n "video gabungan: "; ffprobe -v error -show_entries format=duration -of csv=p=0 rakit/video.mp4

# Peta waktu: B1 0-11.5 | B2 11.5-25 | B3 25-36.5 | B4 36.5-43 | B5 43-50 | B6 50-65
# VO: vo1 @0.35 | vo2 @11.85 | vo3 @25.35 | vo4 @36.85 | vo5 @43.35 | vo6 @50.35
ffmpeg -y -v error -i rakit/video.mp4 \
  -i $O/o1_judul.png -i $O/o_lab_presiden.png -i $O/o_lab_kopdes.png -i $O/o_lab_kopdes2.png \
  -i $O/o_lab_mall.png -i $O/o_lab_mall2.png -i $O/o_lab_dren.png -i $O/o_lab_hafsah.png \
  -i $O/o_voting.png -i $O/o_penutup.png \
  -i rakit/vo1.wav -i rakit/vo2.wav -i rakit/vo3.wav -i rakit/vo4.wav -i rakit/vo5.wav -i rakit/vo6.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,4.2)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,4.4,11.4)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,11.6,17.5)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,17.5,24.9)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,25.1,30.5)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,30.5,36.4)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,36.6,42.9)'[v7];\
[v7][8:v]overlay=0:0:enable='between(t,43.1,49.9)'[v8];\
[v8][9:v]overlay=0:0:enable='between(t,54.5,61.0)'[v9];\
[v9][10:v]overlay=0:0:enable='between(t,61.3,64.6)'[v10];\
[v10]fade=t=out:st=64.4:d=0.6,format=yuv420p[vout];\
[11:a]adelay=350:all=1[a1];\
[12:a]adelay=11850:all=1[a2];\
[13:a]adelay=25350:all=1[a3];\
[14:a]adelay=36850:all=1[a4];\
[15:a]adelay=43350:all=1[a5];\
[16:a]adelay=50350:all=1[a6];\
[a1][a2][a3][a4][a5][a6]amix=inputs=6:normalize=0,apad=whole_dur=65,afade=t=out:st=64.4:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 65 drama_musyawarah.mp4
ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name -show_entries format=duration,size -of default=noprint_wrappers=1 drama_musyawarah.mp4
echo RAKIT9_SELESAI
