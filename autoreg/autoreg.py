#!/usr/bin/env python3
"""Auto-register follower baru @negaramerdu sebagai warga Negara Merdu.

Alur:
1. Ambil daftar follower IG (instagram-cli) dan daftar warga live (API publik).
2. Kandidat = follower yang belum jadi warga, lolos regex username server,
   dan belum pernah gagal permanen. Maks 20 pembuatan per run.
3. Pembuatan dieksekusi DI Hostinger (skrip runner dikirim via host_exec.py):
   token admin dibaca lokal dari .env di sana, POST ke 127.0.0.1:8026.
   Token tidak pernah meninggalkan Hostinger. Akun dibuat dengan PIN
   default 123456, TANPA gender (diisi warga sendiri saat pertama masuk),
   penampilan deterministik dari hash username.
4. State di state.json (ditulis atomik) mencatat yang sudah dibuat/gagal.

Pakai:
  python3 autoreg.py            # run sungguhan
  python3 autoreg.py --dry-run  # hanya cetak kandidat, tidak membuat apa pun

Output baris-baris: CREATED <username> rumah <n> / EXISTS / FAIL / INFO.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(DIR, "state.json")
LOCK = os.path.join(DIR, ".lock")
HOST_EXEC = os.path.join(DIR, "host_exec.py")
ACCOUNT_ID = "17841467282682017"
API = "https://merdu.id/api"
MAKS_PER_RUN = 20

PALET_BAJU = ["#e74c3c", "#9b59b6", "#2471a3", "#f39c12", "#16a085",
              "#8e44ad", "#c0392b", "#2980b9", "#e67e22", "#e84393",
              "#1abc9c", "#795548", "#607d8b"]
PALET_KULIT = ["#f1c27d", "#ffdbac", "#e0ac69", "#ffe0bd"]
PALET_TOPI = ["peci", "topi", "tanpa"]
RE_USERNAME = re.compile(r"^[a-z0-9._]+$")


def penampilan(username: str) -> dict:
    h = int(hashlib.sha256(username.encode()).hexdigest(), 16)
    return {
        "warna_baju": PALET_BAJU[h % len(PALET_BAJU)],
        "warna_kulit": PALET_KULIT[(h >> 8) % len(PALET_KULIT)],
        "topi": PALET_TOPI[(h >> 16) % len(PALET_TOPI)],
    }


def username_sah(u: str) -> bool:
    return bool(RE_USERNAME.match(u)) and not u.startswith(".") and not u.endswith(".")


def ambil_followers() -> list:
    p = subprocess.run(["instagram-cli", "followers", "--account-id", ACCOUNT_ID],
                       capture_output=True, text=True, timeout=120)
    if p.returncode != 0:
        raise RuntimeError("instagram-cli followers gagal: " + p.stderr[-300:])
    data = json.loads(p.stdout)
    return [u["username"].lower() for u in data.get("users", [])]


def ambil_warga() -> set:
    hasil = set()
    offset = 0
    while True:
        url = f"{API}/warga?limit=100&offset={offset}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
        for w in data.get("warga", []):
            hasil.add(w["username"].lower())
        offset += len(data.get("warga", []))
        if offset >= data.get("total", 0) or not data.get("warga"):
            break
    return hasil


def muat_state() -> dict:
    if os.path.exists(STATE):
        with open(STATE) as f:
            return json.load(f)
    return {"created": {}, "failed_permanent": {}}


def simpan_state(state: dict) -> None:
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
    os.replace(tmp, STATE)


RUNNER = '''
import json, urllib.request, urllib.error

KANDIDAT = __KANDIDAT__

token = None
try:
    for line in open("/opt/pinarak/.env"):
        line = line.strip()
        if line.startswith("PINARAK_ADMIN_TOKEN="):
            token = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
except OSError:
    token = None

hasil = []
for k in KANDIDAT:
    body = {"username": k["username"], "pin": "123456",
            "warna_baju": k["warna_baju"], "warna_kulit": k["warna_kulit"],
            "topi": k["topi"]}
    req = urllib.request.Request(
        "http://127.0.0.1:8026/api/daftar",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"})
    if token:
        req.add_header("X-Admin-Token", token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
        w = data.get("warga", {})
        hasil.append({"username": k["username"], "status": r.status,
                      "nomor_rumah": w.get("nomor_rumah"),
                      "blok": w.get("blok"), "kavling": w.get("kavling")})
    except urllib.error.HTTPError as e:
        try:
            pesan = json.loads(e.read()).get("error", "")
        except Exception:
            pesan = ""
        hasil.append({"username": k["username"], "status": e.code, "error": pesan})
    except Exception as e:
        hasil.append({"username": k["username"], "status": 0, "error": str(e)[:200]})
print("HASIL_JSON:" + json.dumps(hasil))
'''


def buat_akun(kandidat: list) -> list:
    skrip = RUNNER.replace("__KANDIDAT__", json.dumps(kandidat))
    p = subprocess.run(["python3", HOST_EXEC], input=skrip.encode(),
                       capture_output=True, timeout=300)
    out = p.stdout.decode(errors="replace")
    for line in out.splitlines():
        if line.startswith("HASIL_JSON:"):
            return json.loads(line[len("HASIL_JSON:"):])
    raise RuntimeError("runner Hostinger tidak memberi hasil. stdout: "
                       + out[-500:] + " stderr: " + p.stderr.decode(errors="replace")[-500:])


def main() -> int:
    dry = "--dry-run" in sys.argv
    try:
        fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
    except FileExistsError:
        print("INFO run lain sedang berjalan, lewati")
        return 0
    try:
        followers = ambil_followers()
        warga = ambil_warga()
        state = muat_state()
        gagal = state.get("failed_permanent", {})
        kandidat_nama = []
        for u in followers:
            if u in warga or u in gagal or u in kandidat_nama:
                continue
            if not username_sah(u):
                gagal[u] = "username tidak lolos regex server"
                continue
            kandidat_nama.append(u)
        kandidat = [dict(username=u, **penampilan(u)) for u in kandidat_nama[:MAKS_PER_RUN]]

        print(f"INFO follower={len(followers)} warga={len(warga)} kandidat={len(kandidat)}")
        for k in kandidat:
            print(f"KANDIDAT {k['username']} baju={k['warna_baju']} kulit={k['warna_kulit']} topi={k['topi']}")
        if dry:
            print("INFO dry-run, tidak ada akun dibuat")
            return 0
        if not kandidat:
            state["failed_permanent"] = gagal
            simpan_state(state)
            print("INFO tidak ada perubahan")
            return 0

        hasil = buat_akun(kandidat)
        for h in hasil:
            u = h["username"]
            if h["status"] == 201:
                state["created"][u] = {"nomor_rumah": h.get("nomor_rumah"),
                                       "blok": h.get("blok"), "kavling": h.get("kavling")}
                print(f"CREATED {u} rumah {h.get('nomor_rumah')} blok {h.get('blok')} kavling {h.get('kavling')}")
            elif h["status"] == 409:
                print(f"EXISTS {u} (sudah terdaftar, dilewati)")
            else:
                print(f"FAIL {u} status={h['status']} error={h.get('error', '')}")
        state["failed_permanent"] = gagal
        simpan_state(state)
        return 0
    finally:
        try:
            os.unlink(LOCK)
        except OSError:
            pass


if __name__ == "__main__":
    sys.exit(main())
