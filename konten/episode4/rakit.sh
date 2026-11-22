#!/bin/bash
# Rakit Episode 4 Negara Merdu: blok frame per segmen -> concat -> overlay + VO.
# Total 74,5 dtk, 720x1280, 24fps. VO profil e076e62d X99 (seg1-6);
# seg3 & seg6 di-atempo 1.12 agar pas blok (pola Episode 3).
set -e
cd ~/workspace/pinarak/konten/episode4
F=frames
O=overlay
V=voicestudio
mkdir -p rakit
cp $V/seg1.wav rakit/vo1.wav
cp $V/seg2.wav rakit/vo2.wav
ffmpeg -y -v error -i $V/seg3.wav -af atempo=1.12 rakit/vo3.wav
cp $V/seg4.wav rakit/vo4.wav
cp $V/seg5.wav rakit/vo5.wav
ffmpeg -y -v error -i $V/seg6.wav -af atempo=1.12 rakit/vo6.wav
for f in rakit/vo1.wav rakit/vo2.wav rakit/vo3.wav rakit/vo4.wav rakit/vo5.wav rakit/vo6.wav; do
  echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"
done

blok() { # nama pola fps
  ffmpeg -y -v error -framerate "$3" -i "$F/$2_%04d.jpg" \
    -vf "scale=720:1280,fps=24,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 "rakit/$1.mp4"
}
# B1 e1 130f/12.0s | B2 t1 70f/10.5s | B3 p1 70f/10.5s
# B4 w1 50f + w2 44f /12.0s | B5 e2 62f + e7 62f /13.0s | B6 f5 50f/8.0s + e6 58f/8.5s
blok b1 e1 10.83
blok b2 t1 6.67
blok b3 p1 6.67
blok b4a w1 7.83
blok b4b w2 7.83
blok b5a e2 9.54
blok b5b e7 9.54
blok b6a f5 6.25
blok b6b e6 6.82
printf "file 'b4a.mp4'\nfile 'b4b.mp4'\n" > rakit/list_b4.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_b4.txt -c copy rakit/b4.mp4
printf "file 'b5a.mp4'\nfile 'b5b.mp4'\n" > rakit/list_b5.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_b5.txt -c copy rakit/b5.mp4
printf "file 'b6a.mp4'\nfile 'b6b.mp4'\n" > rakit/list_b6.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_b6.txt -c copy rakit/b6.mp4
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\nfile 'b5.mp4'\nfile 'b6.mp4'\n" > rakit/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_all.txt -c copy rakit/video.mp4
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 rakit/video.mp4)
echo "durasi video mentah: $DUR"

# Overlay + audio satu pass. Peta waktu absolut (dtk):
# B1 0-12.0 | B2 12.0-22.5 | B3 22.5-33.0 | B4 33.0-45.0 | B5 45.0-58.0 | B6 58.0-74.5
# VO: vo1 @0.3 | vo2 @12.4 | vo3 @22.7 | vo4 @33.5 | vo5 @45.6 | vo6 @58.7
ffmpeg -y -v error -i rakit/video.mp4 \
  -i $O/o1_judul.png -i $O/o2_taman.png -i $O/o3_toko.png -i $O/o4_masuk.png \
  -i $O/o5_absen_judul.png -i $O/o6_absen.png -i $O/o7_kas.png -i $O/o8_penutup.png \
  -i rakit/vo1.wav -i rakit/vo2.wav -i rakit/vo3.wav -i rakit/vo4.wav -i rakit/vo5.wav -i rakit/vo6.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,5.0)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,13.0,22.3)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,23.2,32.8)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,34.0,44.8)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,45.3,48.0)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,48.0,57.8)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,58.6,65.8)'[v7];\
[v7][8:v]overlay=0:0:enable='between(t,66.6,74.2)'[v8];\
[v8]fade=t=out:st=73.9:d=0.6,format=yuv420p[vout];\
[9:a]adelay=300:all=1[a1];\
[10:a]adelay=12400:all=1[a2];\
[11:a]adelay=22700:all=1[a3];\
[12:a]adelay=33500:all=1[a4];\
[13:a]adelay=45600:all=1[a5];\
[14:a]adelay=58700:all=1[a6];\
[a1][a2][a3][a4][a5][a6]amix=inputs=6:normalize=0,apad=whole_dur=74.5,afade=t=out:st=73.9:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 74.5 episode4_vs.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 episode4_vs.mp4
echo RAKIT_SELESAI
