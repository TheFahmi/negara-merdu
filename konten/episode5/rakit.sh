#!/bin/bash
# Rakit Episode 5 Negara Merdu: blok frame per segmen -> concat -> minterpolate -> overlay + VO.
# Total 77,7 dtk, 720x1280, 24fps. VO profil e076e62d X99, satu take per segmen;
# atempo pada seg2-6 agar pas blok (pola Episode 3/4). Frame sumber fps rendah -> minterpolate mci.
set -e
cd ~/workspace/pinarak/konten/episode5
F=frames
O=overlay
V=voicestudio
mkdir -p rakit
cp $V/seg1.wav rakit/vo1.wav
ffmpeg -y -v error -i $V/seg2.wav -af atempo=1.12 rakit/vo2.wav
ffmpeg -y -v error -i $V/seg3.wav -af atempo=1.10 rakit/vo3.wav
ffmpeg -y -v error -i $V/seg4.wav -af atempo=1.15 rakit/vo4.wav
ffmpeg -y -v error -i $V/seg5.wav -af atempo=1.10 rakit/vo5.wav
ffmpeg -y -v error -i $V/seg6.wav -af atempo=1.10 rakit/vo6.wav
for f in rakit/vo1.wav rakit/vo2.wav rakit/vo3.wav rakit/vo4.wav rakit/vo5.wav rakit/vo6.wav; do
  echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"
done

blok() { # nama pola fps
  ffmpeg -y -v error -framerate "$3" -i "$F/$2_%04d.jpg" \
    -vf "scale=720:1280,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 "rakit/$1.mp4"
}
# B1 d1 18f/6.2s | B2 a1 24f/15.6s | B3 a2 20f/12.6s
# B4 k1 26f/19.2s | B5 v1 16f/12.2s | B6 p1 14f/11.9s
blok b1 d1 2.90
blok b2 a1 1.54
blok b3 a2 1.59
blok b4 k1 1.35
blok b5 v1 1.31
blok b6 p1 1.18
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\nfile 'b5.mp4'\nfile 'b6.mp4'\n" > rakit/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_all.txt -c copy rakit/video.mp4
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 rakit/video.mp4)
echo "durasi video mentah: $DUR"

# Overlay + audio satu pass. Peta waktu absolut (dtk):
# B1 0-6.2 | B2 6.2-21.8 | B3 21.8-34.4 | B4 34.4-53.6 | B5 53.6-65.8 | B6 65.8-77.7
# VO: vo1 @0.3 | vo2 @6.5 | vo3 @22.1 | vo4 @34.7 | vo5 @53.9 | vo6 @66.1
ffmpeg -y -v error -i rakit/video.mp4 \
  -i $O/o1_judul.png -i $O/o2_absen_judul.png -i $O/o3_absen1.png -i $O/o4_absen2.png \
  -i $O/o5_kas.png -i $O/o6_voting.png -i $O/o7_penutup.png \
  -i rakit/vo1.wav -i rakit/vo2.wav -i rakit/vo3.wav -i rakit/vo4.wav -i rakit/vo5.wav -i rakit/vo6.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,5.6)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,6.4,9.2)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,8.6,21.6)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,22.0,34.2)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,35.4,53.4)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,54.4,65.6)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,66.4,77.4)'[v7];\
[v7]fade=t=out:st=77.1:d=0.6,format=yuv420p[vout];\
[8:a]adelay=300:all=1[a1];\
[9:a]adelay=6500:all=1[a2];\
[10:a]adelay=22100:all=1[a3];\
[11:a]adelay=34700:all=1[a4];\
[12:a]adelay=53900:all=1[a5];\
[13:a]adelay=66100:all=1[a6];\
[a1][a2][a3][a4][a5][a6]amix=inputs=6:normalize=0,apad=whole_dur=77.7,afade=t=out:st=77.1:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 77.7 episode5_vs.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 episode5_vs.mp4
echo RAKIT_SELESAI
