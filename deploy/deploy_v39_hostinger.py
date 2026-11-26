"""Deploy Negara Merdu v39 (patch MBG/Koperasi/Mall/Stasiun) DI Hostinger — via host_exec.py.

Langkah: pull image app baru dari registry -> retag pinarak-app:latest,
sed tag web next10 -> next11 di compose (backup .bak-next10),
docker compose pull web + up -d, verifikasi ps/inspect/API lokal.
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
    print(r.stdout[-1500:], r.stderr[-800:], "rc=", r.returncode, flush=True)
    return r


def main():
    if run(["docker", "pull", f"{REG}/pinarak-app:latest"]).returncode != 0:
        print("PULL APP GAGAL — batal"); return 1
    if run(["docker", "tag", f"{REG}/pinarak-app:latest", "pinarak-app:latest"]).returncode != 0:
        print("RETAG APP GAGAL — batal"); return 1

    p = f"{CD}/docker-compose.yml"
    s = open(p).read()
    if "negara-merdu-web:next11" not in s:
        if "negara-merdu-web:next10" not in s:
            print("TAG WEB next10 TAK DITEMUKAN — batal"); return 1
        shutil.copy(p, p + ".bak-next10")
        open(p, "w").write(s.replace("negara-merdu-web:next10", "negara-merdu-web:next11"))
        print("compose: next10 -> next11 (backup .bak-next10)", flush=True)

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
            names = [str(x.get("nama", "")) for x in items if isinstance(x, dict)]
            print("PEMBANGUNAN:", len(items), "item; nama:", names, flush=True)
            break
        except Exception as e:
            if i == 14:
                print("API pembangunan gagal:", e, flush=True)
    run(["docker", "logs", "--tail", "15", "pinarak-app-1"])
    return 0


raise SystemExit(main())
