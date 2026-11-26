#!/bin/bash
# Rakit Episode 5 vs3 — capture ALIENWARE (GPU), frame unik rapat.
# Semua segmen DUPLIKASI murni (nearest-timestamp ke kisi 24fps).
# Blend DICOBA untuk segmen <10fps unik (d1/k1/p1) tapi DITOLAK:
# ghosting nyata di menara & papan nama masjid (lihat cek3/k1blend_1.jpg).
# TANPA minterpolate mci, TANPA setpts. VO & peta overlay = versi tayang.
set -e
cd ~/workspace/pinarak/konten/episode5
O=overlay
cp rakit3/b1_dup.mp4 rakit3/b1.mp4
cp rakit3/b4_dup.mp4 rakit3/b4.mp4
cp rakit3/b6_dup.mp4 rakit3/b6.mp4
printf "file 'b1.mp4'\nfile 'b2.mp4'\nfile 'b3.mp4'\nfile 'b4.mp4'\nfile 'b5.mp4'\nfile 'b6.mp4'\n" > rakit3/list_all.txt
ffmpeg -y -v error -f concat -safe 0 -i rakit3/list_all.txt -c copy rakit3/video.mp4
echo -n "video gabungan: "; ffprobe -v error -show_entries format=duration -of csv=p=0 rakit3/video.mp4

# Peta waktu (dtk): B1 0-6.2 | B2 6.2-21.8 | B3 21.8-34.4 | B4 34.4-53.6 | B5 53.6-65.8 | B6 65.8-77.7
# VO: vo1 @0.3 | vo2 @6.5 | vo3 @22.35 | vo4 @34.95 | vo5 @54.73 | vo6 @66.5
ffmpeg -y -v error -i rakit3/video.mp4 \
  -i $O/o1_judul.png -i $O/o2_absen_judul.png -i $O/o3_absen1.png -i $O/o4_absen2.png \
  -i $O/o5_kas.png -i $O/o6_voting.png -i $O/o7_penutup.png \
  -i rakit/vo1.wav -i rakit/vo2.wav -i rakit/vo3.wav -i rakit/vo4.wav -i rakit/vo5.wav -i rakit/vo6.wav \
  -filter_complex "\
[0:v][1:v]overlay=0:0:enable='between(t,0.3,6.0)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,6.3,9.5)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,9.0,21.8)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,22.3,34.4)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,35.6,54.2)'[v5];\
[v5][6:v]overlay=0:0:enable='between(t,55.2,66.1)'[v6];\
[v6][7:v]overlay=0:0:enable='between(t,67.0,77.4)'[v7];\
[v7]fade=t=out:st=77.1:d=0.6,format=yuv420p[vout];\
[8:a]adelay=300:all=1[a1];\
[9:a]adelay=6500:all=1[a2];\
[10:a]adelay=22350:all=1[a3];\
[11:a]adelay=34950:all=1[a4];\
[12:a]adelay=54730:all=1[a5];\
[13:a]adelay=66500:all=1[a6];\
[a1][a2][a3][a4][a5][a6]amix=inputs=6:normalize=0,apad=whole_dur=77.7,afade=t=out:st=77.1:d=0.6[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 19 \
  -c:a aac -b:a 192k -movflags +faststart -t 77.7 episode5_vs3.mp4
ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name -show_entries format=duration,size -of default=noprint_wrappers=1 episode5_vs3.mp4
echo RAKIT3_SELESAI
