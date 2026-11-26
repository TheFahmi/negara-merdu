#!/usr/bin/env python3
"""Resample frame capture Alienware Kenalan Transportasi ke kisi 24fps per blok
dengan nearest-timestamp (duplikasi murni, TANPA interpolasi, TANPA setpts).
Jendela dipilih dari events (dwell) tiap segmen. meta per segmen: meta_aw/meta_<seg>.json
baris [seg, idx, rel_detik, ts_screencast]. Keluar: frames7r/<blok>_r_%04d.jpg + stats."""
import json, os, shutil

BASE = os.path.expanduser("~/workspace/pinarak/konten/kenalan-transportasi")
SRC = os.path.join(BASE, "frames_aw")
OUT = os.path.join(BASE, "frames7r")
os.makedirs(OUT, exist_ok=True)
FPS = 24

# blok: (segmen, rel_mulai, durasi_detik) — rel dari meta segmen itu
BLOK = [
    ("b1", "d1", 0.3, 7.5),
    ("b2", "bl2", None, 12.5),   # None = diisi dari events bl2 (dwell_mulai - 6.5)
    ("b3", "bd", 155.8, 8.0),
    ("b4", "lm2", 102.0, 8.5),
    ("b5", "kl", 19.6, 12.5),
    ("b6a", "kd", 14.85, 5.5),
    ("b6b", "ku", 20.9, 3.5),
    ("b7", "p1", 0.3, 8.5),
]

# isi jendela b2 dari events run 3 bila ada
try:
    ev3 = json.load(open(os.path.join(BASE, "events_run3.json")))
    dm = ev3["bl2"]["info"]["dwell_mulai_rel"]
    BLOK[1] = ("b2", "bl2", round(dm - 4.5, 2), 12.5)
    print("b2 jendela dari events:", BLOK[1])
except Exception as e:
    print("b2: events run3 belum ada (%s) — b2 dilewati bila frame tak ada" % e)

metas = {}
def meta_seg(seg):
    if seg not in metas:
        p = os.path.join(BASE, "meta_aw", "meta_%s.json" % seg)
        metas[seg] = json.load(open(p)) if os.path.exists(p) else []
    return metas[seg]

hasil = {}
for blok, seg, mulai, dur in BLOK:
    if mulai is None:
        print(blok, "jendela belum ditentukan — lewati")
        continue
    rows = sorted(meta_seg(seg), key=lambda r: r[2])
    win = [r for r in rows if mulai <= r[2] <= mulai + dur]
    if not win:
        print(blok, seg, "KOSONG pada jendela", mulai, dur)
        continue
    n_out = round(dur * FPS)
    used = []
    for k in range(n_out):
        target = mulai + (k + 0.5) / FPS
        best = min(win, key=lambda r: abs(r[2] - target))
        used.append(best[1])
        src = os.path.join(SRC, "%s_%04d.jpg" % (seg, best[1]))
        dst = os.path.join(OUT, "%s_r_%04d.jpg" % (blok, k))
        shutil.copyfile(src, dst)
    uniq = len(set(used))
    spacings = [round(win[i + 1][2] - win[i][2], 3) for i in range(len(win) - 1)]
    hasil[blok] = {"segmen": seg, "mulai_rel": mulai, "durasi": dur,
                   "frame_jendela": len(win), "frame_keluar": n_out,
                   "unik_dipakai": uniq, "fps_unik": round(uniq / dur, 1),
                   "jarak_min": min(spacings) if spacings else None,
                   "jarak_maks": max(spacings) if spacings else None}
    print("%s (%s): jendela %d frame, keluar %d, unik %d (%.1f fps unik), jarak %.3f-%.3f" % (
        blok, seg, len(win), n_out, uniq, uniq / dur,
        hasil[blok]["jarak_min"] or 0, hasil[blok]["jarak_maks"] or 0))

json.dump(hasil, open(os.path.join(BASE, "resample7_stats.json"), "w"), indent=1)
print("stats tersimpan")
