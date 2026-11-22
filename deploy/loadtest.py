#!/usr/bin/env python3
"""Uji beban ringan Desa Pinarak — HANYA di DB sementara (default /tmp).
Seed N baris warga sintetis langsung via sqlite (hash dummy 1x dipakai ulang,
tujuannya menguji query, bukan kripto), lalu ukur latensi endpoint statistik
dan pagination lewat HTTP ke server uji lokal. DB dibersihkan di akhir.
"""
import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.request

N = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
TMP = sys.argv[2] if len(sys.argv) > 2 else "/tmp/pinarak-loadtest"
PORT = 18099
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.insert(0, ROOT)
os.environ["DATA_DIR"] = TMP
import server as srv_mod  # noqa: E402

os.makedirs(TMP, exist_ok=True)
dbfile = os.path.join(TMP, "pinarak.db")
if os.path.exists(dbfile):
    os.remove(dbfile)
srv_mod.init_db()

t0 = time.time()
conn = sqlite3.connect(dbfile)
dummy_hash = srv_mod.hash_pin("123456", "00" * 16)
rows = []
for i in range(1, N + 1):
    blok, kavling, _, _ = srv_mod.alokasi(i)
    rows.append((f"uji.beban{i}", dummy_hash, "00" * 16, "#2e9e5b", "#f1c27d",
                 "peci", i, blok, kavling))
conn.executemany(
    "INSERT INTO warga(username,pin_hash,salt,warna_baju,warna_kulit,topi,nomor_rumah,blok,kavling)"
    " VALUES(?,?,?,?,?,?,?,?,?)", rows)
conn.commit(); conn.close()
print(f"seed {N} baris: {time.time()-t0:.2f} dtk")

env = dict(os.environ, DATA_DIR=TMP, PORT=str(PORT))
proc = subprocess.Popen([sys.executable, os.path.join(ROOT, "server.py")],
                        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.2)

    def ukur(url, ulang=5):
        hasil = []
        data = None
        for _ in range(ulang):
            t = time.time()
            with urllib.request.urlopen(url, timeout=10) as r:
                data = json.loads(r.read())
            hasil.append((time.time() - t) * 1000)
        return min(hasil), data

    ms, d = ukur(f"http://127.0.0.1:{PORT}/api/statistik")
    print(f"GET /api/statistik -> {ms:.1f} ms | warga={d['warga']} kapasitas={d['kapasitas']}")
    ms, d = ukur(f"http://127.0.0.1:{PORT}/api/warga?limit=100&offset=0")
    print(f"GET /api/warga?limit=100&offset=0 -> {ms:.1f} ms | total={d['total']} halaman={len(d['warga'])}")
    ms, d = ukur(f"http://127.0.0.1:{PORT}/api/warga?limit=100&offset=19900")
    print(f"GET /api/warga?limit=100&offset=19900 -> {ms:.1f} ms | pertama={d['warga'][0]['username']} blok={d['warga'][0]['blok']} kavling={d['warga'][0]['kavling']}")
    ms, d = ukur(f"http://127.0.0.1:{PORT}/api/warga?limit=500&urut=terbaru")
    print(f"GET /api/warga?limit=500&urut=terbaru -> {ms:.1f} ms | pertama={d['warga'][0]['username']}")
finally:
    proc.terminate()
    for suf in ("", "-wal", "-shm"):
        try:
            os.remove(dbfile + suf)
        except OSError:
            pass
    print("DB sementara dibersihkan")
