"""Deploy Negara Merdu v38 (patch 1-3) DI Hostinger — dijalankan via host_exec.py.

Langkah: pull image app baru dari registry X99 -> retag pinarak-app:latest,
compose web next3 -> next5, compose pull web, up -d, lalu tampilkan status.
"""
import shutil
import subprocess
import sys

REG = "100.120.212.116:5000"
CD = "/opt/pinarak"


def run(cmd):
    r = subprocess.run(cmd, cwd=CD, capture_output=True, text=True)
    print("+", " ".join(cmd))
    sys.stdout.write(r.stdout[-2500:])
    sys.stderr.write(r.stderr[-1200:])
    print("rc=", r.returncode)
    return r


def main():
    if run(["docker", "pull", f"{REG}/pinarak-app:latest"]).returncode != 0:
        print("GAGAL pull app"); return 1
    if run(["docker", "tag", f"{REG}/pinarak-app:latest", "pinarak-app:latest"]).returncode != 0:
        print("GAGAL tag app"); return 1
    p = f"{CD}/docker-compose.yml"
    s = open(p).read()
    if "negara-merdu-web:next5" not in s:
        if "negara-merdu-web:next3" not in s:
            print("TAG WEB TAK DITEMUKAN di compose — batal"); return 1
        shutil.copy(p, p + ".bak-next3")
        open(p, "w").write(s.replace("negara-merdu-web:next3", "negara-merdu-web:next5"))
        print("compose: next3 -> next5 (backup .bak-next3)")
    if run(["docker", "compose", "pull", "web"]).returncode != 0:
        print("GAGAL pull web"); return 1
    if run(["docker", "compose", "up", "-d"]).returncode != 0:
        print("GAGAL up"); return 1
    run(["docker", "compose", "ps"])
    run(["docker", "inspect", "pinarak-app-1", "--format", "app image={{.Image}} started={{.State.StartedAt}}"])
    run(["docker", "inspect", "pinarak-web-1", "--format", "web image={{.Config.Image}} started={{.State.StartedAt}}"])
    run(["curl", "-s", "-m", "10", "http://127.0.0.1:8026/api/statistik"])
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
