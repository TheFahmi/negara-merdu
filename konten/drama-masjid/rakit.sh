#!/bin/bash
# Rakit Drama Masjid Negara Merdu: frame timelapse cadence rendah -> minterpolate 24fps
# -> overlay dialog + VO VoiceStudio. Total 59,5 dtk, 720x1280.
# Blok: B1 0-13 | B2 13-25.5 | B3 25.5-44.5 | B4 44.5-59.5
set -e
cd ~/workspace/pinarak/konten/drama-masjid
F=frames; O=overlay; V=voicestudio
mkdir -p rakit
blok() { # nama pola fps_sumber durasi
  ffmpeg -y -v error -framerate "$3" -i "$F/$2_%04d.jpg" \
    -vf "scale=720:1280,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir,fps=24,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 -t "$4" "rakit/$1.mp4"
}
blok b1 d1 2.77 13
blok b2 d2 2.40 12.5
blok b3 d3 2.32 19
blok b4 d4 2.13 15
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\n" > rakit/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_all.txt -c copy rakit/video.mp4
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 rakit/video.mp4)
echo "durasi video mentah: $DUR"
# VO: nar1 @0.4 | hana1 @13.5 | dren1 @17.8 | taa1 @21.1 | pres1 @26.2 | pres2 @37.1 | dren2 @42.4 | nar2 @45.2
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
[v5][6:v]overlay=0:0:enable='between(t,26.2,36.5)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,37.1,41.8)'[v7];\
[v7][8:v]overlay=0:0:enable='between(t,42.4,44.1)'[v8];\
[v8][9:v]overlay=0:0:enable='between(t,45.2,55.5)'[v9];\
[v9][10:v]overlay=0:0:enable='between(t,55.6,59.2)'[v10];\
[v10]fade=t=out:st=58.9:d=0.6,format=yuv420p[vout];\
[11:a]adelay=400:all=1[a1];\
[12:a]adelay=13500:all=1[a2];\
[13:a]adelay=17800:all=1[a3];\
[14:a]adelay=21100:all=1[a4];\
[15:a]adelay=26200:all=1[a5];\
[16:a]adelay=37100:all=1[a6];\
[17:a]adelay=42400:all=1[a7];\
[18:a]adelay=45200:all=1[a8];\
[a1][a2][a3][a4][a5][a6][a7][a8]amix=inputs=8:normalize=0,apad=whole_dur=59.5,afade=t=out:st=58.9:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 59.5 drama_masjid_vs.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 drama_masjid_vs.mp4
echo RAKIT_SELESAI
