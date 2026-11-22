#!/bin/bash
# Rakit Episode 3 Negara Merdu: blok frame per segmen -> concat -> overlay + VO.
# Total 71,2 dtk, 720x1280, 24fps. VO: seg1b, seg2, seg3b, seg4b, seg5b (profil e076e62d X99).
# seg3b & seg4b di-atempo 1.12 agar pas blok (suara tetap natural, konsisten dua segmen laporan).
set -e
cd ~/workspace/pinarak/konten/episode3
F=frames
O=overlay
V=voicestudio
mkdir -p rakit
cp $V/seg1b.wav rakit/vo1.wav
cp $V/seg2.wav  rakit/vo2.wav
ffmpeg -y -v error -i $V/seg3b.wav -af atempo=1.12 rakit/vo3.wav
ffmpeg -y -v error -i $V/seg4b.wav -af atempo=1.12 rakit/vo4.wav
cp $V/seg5b.wav rakit/vo5.wav
for f in rakit/vo1.wav rakit/vo2.wav rakit/vo3.wav rakit/vo4.wav rakit/vo5.wav; do
  echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"
done

blok() { # nama pola fps
  ffmpeg -y -v error -framerate "$3" -i "$F/$2_%04d.jpg" \
    -vf "scale=720:1280,fps=24,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 "rakit/$1.mp4"
}
# B1 e1 130f/12.0s | B2 k1 80f + k2 30f /9.0s | B3 e2 85f + e7 85f /15.0s
# B4 f5 100f/11.5s | B5 e4 120f/13.0s | B6 e6 95f/10.7s
blok b1 e1 10.83
blok b2a k1 12.22
blok b2b k2 12.22
blok b3a e2 11.33
blok b3b e7 11.33
blok b4 f5 8.70
blok b5 e4c 9.23
blok b6 e6 8.88
printf "file 'b2a.mp4'\nfile 'b2b.mp4'\n" > rakit/list_b2.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_b2.txt -c copy rakit/b2.mp4
printf "file 'b3a.mp4'\nfile 'b3b.mp4'\n" > rakit/list_b3.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_b3.txt -c copy rakit/b3.mp4
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\nfile 'b5.mp4'\nfile 'b6.mp4'\n" > rakit/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_all.txt -c copy rakit/video.mp4
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 rakit/video.mp4)
echo "durasi video mentah: $DUR"

# Overlay + audio satu pass. Peta waktu absolut (dtk):
# B1 0-12.0 | B2 12.0-21.0 | B3 21.0-36.0 | B4 36.0-47.5 | B5 47.5-60.5 | B6 60.5-71.2
# VO: vo1 @0.3 | vo2 @13.0 | vo3 @36.6 | vo4 @50.05 | vo5 @64.4
ffmpeg -y -v error -i rakit/video.mp4 \
  -i $O/o1_judul.png -i $O/o2_sapa.png -i $O/o3_absen_judul.png \
  -i $O/o4_absen_a.png -i $O/o5_absen_b.png -i $O/o6_absen_c.png \
  -i $O/o7_absen_d.png -i $O/o8_kas.png -i $O/o9_voting.png \
  -i $O/o10_bangun.png -i $O/o11_penutup.png \
  -i rakit/vo1.wav -i rakit/vo2.wav -i rakit/vo3.wav -i rakit/vo4.wav -i rakit/vo5.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,4.8)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,12.6,16.8)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,21.3,22.9)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,22.9,26.2)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,26.2,29.5)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,29.5,32.8)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,32.8,36.0)'[v7];\
[v7][8:v]overlay=0:0:enable='between(t,37.2,47.3)'[v8];\
[v8][9:v]overlay=0:0:enable='between(t,48.2,55.6)'[v9];\
[v9][10:v]overlay=0:0:enable='between(t,55.8,60.3)'[v10];\
[v10][11:v]overlay=0:0:enable='between(t,64.6,70.9)'[v11];\
[v11]fade=t=out:st=70.6:d=0.6,format=yuv420p[vout];\
[12:a]adelay=300:all=1[a1];\
[13:a]adelay=13000:all=1[a2];\
[14:a]adelay=36600:all=1[a3];\
[15:a]adelay=50050:all=1[a4];\
[16:a]adelay=64400:all=1[a5];\
[a1][a2][a3][a4][a5]amix=inputs=5:normalize=0,apad=whole_dur=71.2,afade=t=out:st=70.6:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 71.2 episode3_vs.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 episode3_vs.mp4
echo RAKIT_SELESAI
