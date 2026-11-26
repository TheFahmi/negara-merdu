"""Deploy web Negara Merdu next21 (patch 4) DI Hostinger — via host_exec.py."""
import shutil
import subprocess
import sys

CD = "/opt/pinarak"


def run(cmd):
    r = subprocess.run(cmd, cwd=CD, capture_output=True, text=True)
    print("+", " ".join(cmd))
    sys.stdout.write(r.stdout[-1500:])
    sys.stderr.write(r.stderr[-800:])
    print("rc=", r.returncode)
    return r


def main():
    p = f"{CD}/docker-compose.yml"
    s = open(p).read()
    if "negara-merdu-web:next21" not in s:
        if "negara-merdu-web:next20" not in s:
            print("TAG WEB next20 TAK DITEMUKAN — batal"); return 1
        shutil.copy(p, p + ".bak-next20")
        open(p, "w").write(s.replace("negara-merdu-web:next20", "negara-merdu-web:next21"))
        print("compose: next20 -> next21 (backup .bak-next20)")
    if run(["docker", "compose", "pull", "web"]).returncode != 0:
        print("GAGAL pull web"); return 1
    if run(["docker", "compose", "up", "-d"]).returncode != 0:
        print("GAGAL up"); return 1
    run(["docker", "compose", "ps"])
    run(["docker", "inspect", "pinarak-web-1", "--format", "web image={{.Config.Image}} started={{.State.StartedAt}}"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
