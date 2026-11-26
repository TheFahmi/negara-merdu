#!/bin/bash
# Rakit Teaser Apartemen Negara Merdu: frame timelapse -> minterpolate 24fps
# -> overlay kartu + VO VoiceStudio (semua profil Narator Pinarak e076e62d).
# Total 43,5 dtk, 720x1280.
# Blok: B1 0-9,5 | B2 9,5-23,5 | B3 23,5-38 | B4 38-43,5
# VO: nar1 @0,5 (7,71) | pres1 @10,1 (4,0) | pres2 @14,6 (8,39) |
#     nar2 @24,0 (13,49) | nar3 @39,0 (1,88)
set -e
cd ~/workspace/pinarak/konten/teaser-apartemen
F=frames; O=overlay; V=voicestudio
mkdir -p rakit
blok() { # nama pola fps_sumber durasi
  ffmpeg -y -v error -framerate "$3" -i "$F/$2_%04d.jpg" \
    -vf "scale=720:1280,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir,fps=24,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 -t "$4" "rakit/$1.mp4"
}
blok b1 t1 2.4211 9.5
blok b2 t2 2.4286 14
blok b3 t3 2.4138 14.5
blok b4 t4 2.3636 5.5
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\n" > rakit/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_all.txt -c copy rakit/video.mp4
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 rakit/video.mp4)
echo "durasi video mentah: $DUR"
ffmpeg -y -v error -i rakit/video.mp4 \
  -i $O/o1_judul.png -i $O/o2_nar1.png -i $O/o3_pres1.png -i $O/o4_pres2.png \
  -i $O/o5_viz.png -i $O/o6_nar2.png -i $O/o7_kas.png -i $O/o8_penutup.png \
  -i $V/nar1.wav -i $V/pres1.wav -i $V/pres2.wav -i $V/nar2.wav -i $V/nar3.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,4.2)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,0.5,8.7)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,10.1,14.5)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,14.6,23.3)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,23.8,37.9)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,24.0,30.5)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,30.5,37.7)'[v7];\
[v7][8:v]overlay=0:0:enable='between(t,38.2,43.2)'[v8];\
[v8]fade=t=out:st=42.9:d=0.6,format=yuv420p[vout];\
[9:a]adelay=500:all=1[a1];\
[10:a]adelay=10100:all=1[a2];\
[11:a]adelay=14600:all=1[a3];\
[12:a]adelay=24000:all=1[a4];\
[13:a]adelay=39000:all=1[a5];\
[a1][a2][a3][a4][a5]amix=inputs=5:normalize=0,apad=whole_dur=43.5,afade=t=out:st=42.9:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 43.5 teaser_apartemen_vs.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 teaser_apartemen_vs.mp4
echo RAKIT_SELESAI
