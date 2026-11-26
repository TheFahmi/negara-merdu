#!/usr/bin/env python3
"""Resample frame capture Alienware (frames3 + meta3.json) ke kisi 24fps
per segmen dengan nearest-timestamp (duplikasi murni, tanpa interpolasi).
Menulis frames3r/<seg>_r_%04d.jpg dan statistik fps unik per segmen.
Segmen dengan fps unik < 10 ditandai untuk blend di tahap encode."""
import json, os, shutil, sys

BASE = os.path.expanduser("~/workspace/pinarak/konten/episode5")
SRC = os.path.join(BASE, "frames3")
OUT = os.path.join(BASE, "frames3r")
os.makedirs(OUT, exist_ok=True)

SEG_DUR = {"d1": 6.2, "a1": 15.6, "a2": 12.6, "k1": 19.2, "v1": 12.2, "p1": 11.9}
FPS = 24

meta = json.load(open(os.path.join(BASE, "meta3.json")))
per = {}
for seg, idx, ts, wall in meta:
    per.setdefault(seg, []).append((idx, ts, wall))

hasil = {}
for seg, dur in SEG_DUR.items():
    rows = sorted(per.get(seg, []))
    if not rows:
        print(seg, "KOSONG!")
        continue
    t0 = rows[0][2]
    # jendela animator: kedatangan pertama .. t0+durasi+0.35 (ekor statis dibuang)
    win = [r for r in rows if r[2] - t0 <= dur + 0.35]
    n_out = round(dur * FPS)
    used = []
    for k in range(n_out):
        target = t0 + (k + 0.5) / FPS
        best = min(win, key=lambda r: abs(r[2] - target))
        used.append(best[0])
        src = os.path.join(SRC, "%s_%04d.jpg" % (seg, best[0]))
        dst = os.path.join(OUT, "%s_r_%04d.jpg" % (seg, k))
        shutil.copyfile(src, dst)
    uniq = len(set(used))
    spacings = [round(win[i + 1][2] - win[i][2], 3) for i in range(len(win) - 1)]
    hasil[seg] = {
        "durasi": dur, "frame_jendela": len(win), "frame_keluar": n_out,
        "unik_dipakai": uniq, "fps_unik": round(uniq / dur, 1),
        "jarak_min": min(spacings) if spacings else None,
        "jarak_maks": max(spacings) if spacings else None,
        "blend": (uniq / dur) < 10,
    }
    print("%s: jendela %d frame, keluar %d, unik %d (%.1f fps unik), jarak %.3f-%.3f dtk, blend=%s" % (
        seg, len(win), n_out, uniq, uniq / dur,
        hasil[seg]["jarak_min"] or 0, hasil[seg]["jarak_maks"] or 0, hasil[seg]["blend"]))

json.dump(hasil, open(os.path.join(BASE, "resample3_stats.json"), "w"), indent=1)
print("RESAMPLE_OK")
