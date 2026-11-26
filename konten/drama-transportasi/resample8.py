#!/usr/bin/env python3
"""Resample frame capture Alienware Drama Transportasi ke kisi 24fps per blok
dengan nearest-timestamp (duplikasi murni, TANPA interpolasi, TANPA setpts).
Jendela dipilih dari events/meta tiap segmen (run 13:1x, browser tunggal bersih)."""
import json, os, shutil

BASE = os.path.expanduser("~/workspace/pinarak/konten/drama-transportasi")
SRC = os.path.join(BASE, "frames_aw")
OUT = os.path.join(BASE, "frames8r")
os.makedirs(OUT, exist_ok=True)
FPS = 24

# blok: (segmen, rel_mulai, durasi_detik)
BLOK = [
    ("b1", "d8", 4.5, 6.5),     # drone pagi -> istana (seg1) — sub-jendela terpadat d8
    ("b2", "ist", 0.5, 9.5),    # Presiden di Istana (seg2)
    ("b3", "hl", 1.2, 9.5),     # Halte Plaza: bus tiba, warga menunggu (seg3)
    ("b4", "bd8", 230.5, 7.5),  # interior bus: dwell halte -> berangkat (seg4)
    ("b5", "lm8", 10.5, 7.5),   # interior bus: berhenti lampu merah -> jalan
    ("b6", "kl8", 42.5, 8.5),   # Stasiun Merdu: KRL tiba & berhenti (seg5)
    ("b7", "kd8", 17.5, 6.0),   # interior KRL: berangkat, lorong gerbong
    ("b8", "ku8", 66.0, 7.5),   # Stasiun Merdu Utara: KRL berhenti (seg6)
    ("b9", "p8", 0.3, 8.5),     # penutup wide kota + stasiun (seg7)
]

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

json.dump(hasil, open(os.path.join(BASE, "resample8_stats.json"), "w"), indent=1)
print("stats tersimpan")
