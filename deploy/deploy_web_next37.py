"""Deploy web Negara Merdu next37 (audit skala kendaraan GLB: becak 2,0->2,5, motor 1,94->2,17, jip 2,37->2,55) DI Hostinger — via host_exec.py."""
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
    if "negara-merdu-web:next37" not in s:
        if "negara-merdu-web:next36" not in s:
            print("TAG WEB next36 TAK DITEMUKAN — batal"); return 1
        shutil.copy(p, p + ".bak-next36")
        open(p, "w").write(s.replace("negara-merdu-web:next36", "negara-merdu-web:next37"))
        print("compose: next36 -> next37 (backup .bak-next36)")
    if run(["docker", "compose", "pull", "web"]).returncode != 0:
        print("GAGAL pull web"); return 1
    if run(["docker", "compose", "up", "-d"]).returncode != 0:
        print("GAGAL up"); return 1
    run(["docker", "compose", "ps"])
    run(["docker", "inspect", "pinarak-web-1", "--format", "web image={{.Config.Image}} started={{.State.StartedAt}}"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
