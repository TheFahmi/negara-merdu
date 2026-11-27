#!/usr/bin/env python3
"""Verifier reset PIN Negara Merdu — sisi Muse dari alur "Lupa PIN?".

Alur (arah ditetapkan Pak Presiden, 26 Nov 2026):
1. Warga meminta reset di merdu.id -> server membuat sesi + kode yang
   DITAMPILKAN DI SITUS (server hanya menyimpan hash PBKDF2-nya).
2. Warga mengirim kode itu sendiri lewat DM ke Instagram @negaramerdu.
3. Skrip INI (cron tiap ±60 detik) membaca inbox @negaramerdu (folder
   inbox + pending/message-requests), mencocokkan DM yang pengirimnya ==
   username sesi DAN memuat kode sesi (dicek terhadap hash, skema
   PBKDF2-HMAC-SHA256 120rb iterasi — sama seperti HashPIN server), lalu
   menandai sesi TERVERIFIKASI lewat endpoint admin server.
4. Warga menetapkan PIN baru di situs.

Token admin tidak pernah meninggalkan Hostinger: daftar sesi pending &
penandaan verifikasi dieksekusi DI Hostinger lewat runner yang dikirim
via autoreg/host_exec.py (token dibaca lokal dari /opt/pinarak/.env di
sana), persis pola autoreg.

Nilai kode sesi tidak pernah dicetak/di-log: yang mengalir hanya hash.

Pakai:
  python3 verifier.py            # satu siklus polling
  python3 verifier.py --dry-run  # tampilkan kecocokan tanpa menandai

Output baris-baris: INFO / TERVERIFIKASI <username> / FAIL.
Log juga ditulis ke verifier.log di folder ini (ringkas, tanpa kode).
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import time

DIR = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(DIR, "state.json")
LOCK = os.path.join(DIR, ".lock")
LOG = os.path.join(DIR, "verifier.log")
HOST_EXEC = os.path.join(DIR, "..", "autoreg", "host_exec.py")
IG_CLI = "/opt/hatch/bin/instagram-messages-cli"
ACCOUNT_ID = "17841467282682017"  # @negaramerdu
# Format kode reset (samakan persis alfabetKodeReset di backend):
# "MRD-" + 8 karakter huruf kapital + angka tanpa 0/O/1/I/L — sengaja
# BUKAN 6 digit angka supaya tidak ambigu dengan PIN warga.
RE_KODE = re.compile(r"MRD-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}", re.IGNORECASE)
TOLERANSI_MS = 120_000  # DM boleh tercatat s/d 2 menit sebelum sesi dibuat (skew jam)


def log(pesan: str) -> None:
    baris = time.strftime("%Y-%m-%d %H:%M:%S") + " " + pesan
    print(baris, flush=True)
    try:
        with open(LOG, "a") as f:
            f.write(baris + "\n")
    except OSError:
        pass


def muat_state() -> dict:
    if os.path.exists(STATE):
        with open(STATE) as f:
            return json.load(f)
    return {"terverifikasi": {}}


def simpan_state(state: dict) -> None:
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
    os.replace(tmp, STATE)


RUNNER_PENDING = '''
import json, urllib.request, urllib.error

token = ""
try:
    for line in open("/opt/pinarak/.env"):
        line = line.strip()
        if line.startswith("PINARAK_ADMIN_TOKEN="):
            token = line.split("=", 1)[1].strip().strip('"')
            break
except OSError:
    token = ""

req = urllib.request.Request(
    "http://127.0.0.1:8026/api/admin/reset-pin/pending",
    data=b"{}",
    headers={"Content-Type": "application/json", "X-Admin-Token": token})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    print("PENDING_JSON:" + json.dumps(data.get("sesi", [])))
except urllib.error.HTTPError as e:
    print("PENDING_ERROR:" + str(e.code))
except Exception as e:
    print("PENDING_ERROR:" + str(e)[:200])
'''

RUNNER_VERIFIKASI = '''
import json, urllib.request, urllib.error

IDS = __IDS__

token = ""
try:
    for line in open("/opt/pinarak/.env"):
        line = line.strip()
        if line.startswith("PINARAK_ADMIN_TOKEN="):
            token = line.split("=", 1)[1].strip().strip('"')
            break
except OSError:
    token = ""

hasil = []
for sid in IDS:
    req = urllib.request.Request(
        "http://127.0.0.1:8026/api/admin/reset-pin/verifikasi",
        data=json.dumps({"id": sid}).encode(),
        headers={"Content-Type": "application/json", "X-Admin-Token": token})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
        hasil.append({"id": sid, "status": r.status, "ok": bool(data.get("ok"))})
    except urllib.error.HTTPError as e:
        hasil.append({"id": sid, "status": e.code, "ok": False})
    except Exception as e:
        hasil.append({"id": sid, "status": 0, "ok": False, "error": str(e)[:200]})
print("VERIFIKASI_JSON:" + json.dumps(hasil))
'''


def jalankan_runner(skrip: str, awalan: str) -> object:
    p = subprocess.run(["python3", HOST_EXEC], input=skrip.encode(),
                       capture_output=True, timeout=300)
    out = p.stdout.decode(errors="replace")
    for line in out.splitlines():
        if line.startswith(awalan + "_JSON:"):
            return json.loads(line[len(awalan) + 6:])
        if line.startswith(awalan + "_ERROR:"):
            raise RuntimeError("runner Hostinger: " + line[len(awalan) + 7:])
    raise RuntimeError("runner Hostinger tidak memberi hasil. stdout: "
                       + out[-400:] + " stderr: " + p.stderr.decode(errors="replace")[-400:])


def ambil_pending() -> list:
    return jalankan_runner(RUNNER_PENDING, "PENDING")


def tandai_terverifikasi(ids: list) -> list:
    skrip = RUNNER_VERIFIKASI.replace("__IDS__", json.dumps(ids))
    return jalankan_runner(skrip, "VERIFIKASI")


def ambil_inbox(folder: str | None) -> list:
    cmd = [IG_CLI, "inbox", "--account-id", ACCOUNT_ID]
    if folder:
        cmd += ["--folder", folder]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if p.returncode != 0:
        raise RuntimeError(f"instagram-messages-cli inbox gagal: {p.stderr[-300:]}")
    data = json.loads(p.stdout)
    return data.get("threads", [])


def ambil_thread(thread_fbid: str) -> dict | None:
    """Ambil isi penuh satu thread (daftar pesan inbox bisa terpotong)."""
    p = subprocess.run([IG_CLI, "thread", "--account-id", ACCOUNT_ID,
                        "--thread-id", str(thread_fbid)],
                       capture_output=True, text=True, timeout=180)
    if p.returncode != 0:
        return None
    try:
        data = json.loads(p.stdout)
    except ValueError:
        return None
    if isinstance(data, dict) and data.get("messages"):
        return data
    return None


def pesan_dari_threads(threads: list) -> list:
    """Ratakan thread -> daftar pesan ber-username pengirim.

    Struktur CLI: thread.users[] = {id (fbid), username, ...};
    thread.messages[] = {sender_fbid, timestamp (ms, string),
    content: {text_body}}. Pesan dari akun @negaramerdu sendiri tidak
    ada di users[] sehingga otomatis terlewat.
    """
    hasil = []
    for t in threads:
        peta = {}
        for u in t.get("users", []):
            if u.get("id") and u.get("username"):
                peta[str(u["id"])] = str(u["username"]).lower()
        for m in t.get("messages", []):
            pengirim = peta.get(str(m.get("sender_fbid")))
            if not pengirim:
                continue
            teks = ((m.get("content") or {}).get("text_body")) or ""
            try:
                ts = int(m.get("timestamp") or 0)
            except (TypeError, ValueError):
                ts = 0
            hasil.append({"username": pengirim, "teks": teks, "ts": ts,
                          "thread": t.get("thread_fbid")})
    return hasil


def kode_cocok(kandidat: str, kode_hash: str, salt_hex: str) -> bool:
    try:
        garam = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", kandidat.encode(), garam, 120_000, dklen=32)
    return dk.hex() == kode_hash


def main() -> int:
    dry = "--dry-run" in sys.argv
    try:
        fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
    except FileExistsError:
        log("INFO run lain sedang berjalan, lewati")
        return 0
    try:
        pending = ambil_pending()
        if not pending:
            log("INFO pending=0")
            return 0
        threads = {}
        for folder in (None, "pending"):
            for t in ambil_inbox(folder):
                if t.get("thread_fbid"):
                    threads[str(t["thread_fbid"])] = t
        pesan = pesan_dari_threads(list(threads.values()))
        # Thread milik username pending yang pesannya belum ketemu:
        # ambil isi penuhnya (daftar inbox hanya memuat pesan terbaru).
        username_pending = {s["username"] for s in pending}
        sudah = {p["username"] for p in pesan}
        for t in threads.values():
            ikut = {str(u.get("username", "")).lower() for u in t.get("users", [])}
            if ikut & username_pending and not (ikut & sudah):
                penuh = ambil_thread(t["thread_fbid"])
                if penuh:
                    gabung = dict(t)
                    gabung["messages"] = penuh.get("messages", [])
                    pesan += pesan_dari_threads([gabung])
        state = muat_state()
        cocok = []
        for s in pending:
            batas_ms = int(s["dibuat"]) * 1000 - TOLERANSI_MS
            for p in pesan:
                if p["username"] != s["username"] or p["ts"] < batas_ms:
                    continue
                for kandidat in RE_KODE.findall(p["teks"]):
                    if kode_cocok(kandidat.upper(), s["kode_hash"], s["salt"]):
                        cocok.append(s)
                        break
                if cocok and cocok[-1] is s:
                    break
        log(f"INFO pending={len(pending)} thread={len(threads)} pesan={len(pesan)} cocok={len(cocok)}")
        if not cocok:
            return 0
        if dry:
            for s in cocok:
                log(f"TERVERIFIKASI(dry-run) {s['username']} sesi {s['id']}")
            return 0
        hasil = tandai_terverifikasi([s["id"] for s in cocok])
        by_id = {s["id"]: s for s in cocok}
        for h in hasil:
            s = by_id.get(h["id"])
            if s and h.get("ok"):
                state["terverifikasi"][str(s["id"])] = {
                    "username": s["username"],
                    "pada": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
                log(f"TERVERIFIKASI {s['username']} sesi {s['id']}")
            else:
                log(f"FAIL tandai sesi {h['id']} status={h.get('status')}")
        simpan_state(state)
        return 0
    except Exception as e:
        log("FAIL " + str(e)[:300])
        return 1
    finally:
        try:
            os.unlink(LOCK)
        except OSError:
            pass


if __name__ == "__main__":
    sys.exit(main())
