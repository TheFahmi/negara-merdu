#!/bin/bash
# Rakit Kenalan Transportasi Negara Merdu — capture ALIENWARE (GPU RTX 3070 Ti).
# Resample nearest-timestamp ke 24fps (duplikasi murni). TANPA minterpolate, TANPA setpts.
# VO satu take per segmen (profil Narator Pinarak e076e62d); semua muat tanpa atempo.
# Blok: B1 7.5 | B2 12.5 | B3 8.0 | B4 8.5 | B5 12.5 | B6a 5.5 | B6b 3.5 | INFO 3.5 | B7 8.5 = 70.0 dtk.
set -e
cd ~/workspace/pinarak/konten/kenalan-transportasi
F=frames7r
O=overlay
V=voicestudio
mkdir -p rakit
for n in 1 2 3 4 5 6 7; do cp $V/seg$n.wav rakit/vo$n.wav; done
for f in rakit/vo*.wav; do echo -n "$f: "; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"; done

blok() { # nama pola
  ffmpeg -y -v error -framerate 24 -i "$F/$2_r_%04d.jpg" \
    -vf "scale=720:1280,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 "rakit/$1.mp4"
}
blok b1 b1
blok b2 b2
blok b3 b3
blok b4 b4
blok b5 b5
blok b6a b6a
blok b6b b6b
blok b7 b7
# blok info: still dari frame ku + kartu info
python3 - <<'EOF'
from PIL import Image
bg = Image.open("frames7r/b6b_r_0040.jpg").convert("RGBA")
ov = Image.open("overlay/o_info.png")
bg.alpha_composite(ov)
bg.convert("RGB").save("rakit/info_still.jpg", quality=92)
print("info still ok")
EOF
ffmpeg -y -v error -loop 1 -framerate 24 -i rakit/info_still.jpg \
  -vf "scale=720:1280,format=yuv420p" -t 3.5 \
  -c:v libx264 -preset medium -crf 19 rakit/b6c.mp4
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\nfile 'b5.mp4'\nfile 'b6a.mp4'\nfile 'b6b.mp4'\nfile 'b6c.mp4'\nfile 'b7.mp4'\n" > rakit/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit/list_all.txt -c copy rakit/video.mp4
echo -n "video gabungan: "; ffprobe -v error -show_entries format=duration -of csv=p=0 rakit/video.mp4

# Peta waktu: B1 0-7.5 | B2 7.5-20 | B3 20-28 | B4 28-36.5 | B5 36.5-49 | B6a 49-54.5 | B6b 54.5-58 | INFO 58-61.5 | B7 61.5-70
# VO: vo1 @0.35 | vo2 @7.85 | vo3 @20.35 | vo4 @28.35 | vo5 @36.85 | vo6 @49.35 | vo7 @61.85
ffmpeg -y -v error -i rakit/video.mp4 \
  -i $O/o1_judul.png -i $O/o_lab_bus.png -i $O/o_lab_dalambus.png -i $O/o_lab_lampu.png \
  -i $O/o_lab_krl.png -i $O/o_lab_dalamkrl.png -i $O/o_lab_utara.png -i $O/o7_penutup.png \
  -i rakit/vo1.wav -i rakit/vo2.wav -i rakit/vo3.wav -i rakit/vo4.wav -i rakit/vo5.wav -i rakit/vo6.wav -i rakit/vo7.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,4.2)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,7.6,19.9)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,20.1,27.9)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,28.1,36.4)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,36.6,48.9)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,49.1,54.4)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,54.6,57.9)'[v7];\
[v7][8:v]overlay=0:0:enable='between(t,66.0,69.7)'[v8];\
[v8]fade=t=out:st=69.4:d=0.6,format=yuv420p[vout];\
[9:a]adelay=350:all=1[a1];\
[10:a]adelay=7850:all=1[a2];\
[11:a]adelay=20350:all=1[a3];\
[12:a]adelay=28350:all=1[a4];\
[13:a]adelay=36850:all=1[a5];\
[14:a]adelay=49350:all=1[a6];\
[15:a]adelay=61850:all=1[a7];\
[a1][a2][a3][a4][a5][a6][a7]amix=inputs=7:normalize=0,apad=whole_dur=70,afade=t=out:st=69.4:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 70 kenalan_transportasi.mp4
ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name -show_entries format=duration,size -of default=noprint_wrappers=1 kenalan_transportasi.mp4
echo RAKIT7_SELESAI
