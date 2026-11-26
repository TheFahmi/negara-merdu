"""Deploy Negara Merdu next32 (patch 0036-0040: Pemilu + karakter besar) DI Hostinger — via host_exec.py.

Backend: pull pinarak-app:latest dari registry -> retag lokal.
Web: sed tag next31 -> next32 di compose (backup .bak-next31), pull, up -d, verifikasi.
"""
import json
import shutil
import subprocess
import time
import urllib.request

REG = "100.120.212.116:5000"
CD = "/opt/pinarak"


def run(cmd):
    print("+", " ".join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=CD, capture_output=True, text=True)
    print(r.stdout[-1200:], r.stderr[-600:], "rc=", r.returncode, flush=True)
    return r


def main():
    if run(["docker", "pull", f"{REG}/pinarak-app:latest"]).returncode != 0:
        print("PULL APP GAGAL — batal"); return 1
    if run(["docker", "tag", f"{REG}/pinarak-app:latest", "pinarak-app:latest"]).returncode != 0:
        print("RETAG APP GAGAL — batal"); return 1

    p = f"{CD}/docker-compose.yml"
    s = open(p).read()
    if "negara-merdu-web:next32" not in s:
        if "negara-merdu-web:next31" not in s:
            print("TAG WEB next31 TAK DITEMUKAN — batal"); return 1
        shutil.copy(p, p + ".bak-next31")
        open(p, "w").write(s.replace("negara-merdu-web:next31", "negara-merdu-web:next32"))
        print("compose: next31 -> next32 (backup .bak-next31)", flush=True)

    if run(["docker", "compose", "pull", "web"]).returncode != 0:
        print("PULL WEB GAGAL — batal"); return 1
    run(["docker", "compose", "up", "-d"])
    run(["docker", "compose", "ps"])
    run(["docker", "inspect", "pinarak-web-1", "--format", "web image={{.Config.Image}} started={{.State.StartedAt}}"])
    run(["docker", "inspect", "pinarak-app-1", "--format", "app image={{.Image}} started={{.State.StartedAt}}"])

    for i in range(15):
        time.sleep(2)
        try:
            with urllib.request.urlopen("http://127.0.0.1:8026/api/pembangunan", timeout=5) as r:
                data = json.load(r)
            items = data if isinstance(data, list) else data.get("fasilitas") or data.get("items") or []
            print("PEMBANGUNAN OK:", len(items), "item", flush=True)
            break
        except Exception as e:
            if i == 14:
                print("API pembangunan gagal:", e, flush=True)
    run(["docker", "logs", "--tail", "12", "pinarak-app-1"])
    return 0


raise SystemExit(main())
