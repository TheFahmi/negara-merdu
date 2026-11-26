#!/usr/bin/env python3
"""Resample frame capture Alienware Drama Musyawarah ke kisi 24fps per blok
dengan nearest-timestamp (duplikasi murni, TANPA interpolasi, TANPA setpts).
Jendela dipilih dari meta tiap segmen; sesuaikan MULAI bila perlu sesudah cek meta."""
import json, os, shutil, sys

BASE = os.path.expanduser("~/workspace/pinarak/konten/drama-musyawarah")
SRC = os.path.join(BASE, "frames_aw")
OUT = os.path.join(BASE, "frames9r")
os.makedirs(OUT, exist_ok=True)
FPS = 24

# blok: (segmen, rel_mulai, durasi_detik) — total 65.0 dtk
BLOK = [
    ("b1", "ist", 0.5, 11.5),   # Presiden membuka musyawarah (seg1, VO 10.07)
    ("b2", "kop", 0.5, 13.5),   # drone lahan Blok 997 kopdes (seg2, VO 12.26)
    ("b3", "mal", 0.5, 11.5),   # drone lahan Blok 2917 mall (seg3, VO 10.41)
    ("b4", "plzB", 0.5, 6.5),   # plaza: warga pro kopdes (seg4, VO 4.80)
    ("b5", "plzA", 0.5, 7.0),   # halte plaza: warga pro mall (seg5, VO 5.26)
    ("b6", "p9", 0.5, 15.0),    # penutup wide kota (seg6, VO 13.18)
]
if len(sys.argv) > 1 and sys.argv[1] == "cek":
    BLOK = [(b, s, m, d) for (b, s, m, d) in BLOK]

metas = {}
def meta_seg(seg):
    if seg not in metas:
        p = os.path.join(BASE, "meta_aw", "meta_%s.json" % seg)
        metas[seg] = json.load(open(p)) if os.path.exists(p) else []
    return metas[seg]

hasil = {}
for blok, seg, mulai, dur in BLOK:
    rows = sorted(meta_seg(seg), key=lambda r: r[2])
    win = [r for r in rows if mulai <= r[2] <= mulai + dur]
    if not win:
        print(blok, seg, "KOSONG pada jendela", mulai, dur, "| total frame seg:", len(rows))
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

json.dump(hasil, open(os.path.join(BASE, "resample9_stats.json"), "w"), indent=1)
print("stats tersimpan")
