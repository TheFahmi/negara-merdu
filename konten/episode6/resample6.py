#!/usr/bin/env python3
"""Resample frame capture Alienware Ep6 (frames_aw + meta.json) ke kisi 24fps
per segmen dengan nearest-timestamp (duplikasi murni, tanpa interpolasi).
meta.json format: [seg, idx, rel_detik_dari_startAnim, ts_screencast].
Frame dengan rel < 0.12 dibuang (sisa frame view default pipa compositor).
Menulis frames6r/<seg>_r_%04d.jpg + resample6_stats.json."""
import json, os, shutil

BASE = os.path.expanduser("~/workspace/pinarak/konten/episode6")
SRC = os.path.join(BASE, "frames_aw")
OUT = os.path.join(BASE, "frames6r")
os.makedirs(OUT, exist_ok=True)

SEG_DUR = {"d1": 6.2, "a1": 15.6, "a2": 14.6, "k1": 19.2, "v1": 12.2, "p1": 12.2}
FPS = 24

meta = json.load(open(os.path.join(BASE, "meta.json")))
per = {}
for seg, idx, rel, ts in meta:
    per.setdefault(seg, []).append((idx, rel))

hasil = {}
for seg, dur in SEG_DUR.items():
    rows = sorted(per.get(seg, []), key=lambda r: r[1])
    win = [r for r in rows if 0.12 <= r[1] <= dur]
    if not win:
        print(seg, "KOSONG!")
        continue
    n_out = round(dur * FPS)
    used = []
    for k in range(n_out):
        target = (k + 0.5) / FPS
        best = min(win, key=lambda r: abs(r[1] - target))
        used.append(best[0])
        src = os.path.join(SRC, "%s_%04d.jpg" % (seg, best[0]))
        dst = os.path.join(OUT, "%s_r_%04d.jpg" % (seg, k))
        shutil.copyfile(src, dst)
    uniq = len(set(used))
    spacings = [round(win[i + 1][1] - win[i][1], 3) for i in range(len(win) - 1)]
    hasil[seg] = {
        "durasi": dur, "frame_jendela": len(win), "frame_keluar": n_out,
        "unik_dipakai": uniq, "fps_unik": round(uniq / dur, 1),
        "jarak_min": min(spacings) if spacings else None,
        "jarak_maks": max(spacings) if spacings else None,
    }
    print("%s: jendela %d frame, keluar %d, unik %d (%.1f fps unik), jarak %.3f-%.3f dtk" % (
        seg, len(win), n_out, uniq, uniq / dur,
        hasil[seg]["jarak_min"] or 0, hasil[seg]["jarak_maks"] or 0))

json.dump(hasil, open(os.path.join(BASE, "resample6_stats.json"), "w"), indent=1)
print("stats tersimpan")
