"""Deploy web Negara Merdu next10 (keputusan Fahmi 22 Nov: sistem mobil
berjalan kendaraan.js ±320 DIMATIKAN, yang hidup hanya arteri kota.js 64
mobil + mobil parkir/pajangan) DI Hostinger — via host_exec.py."""
import subprocess, sys, time, os, shutil

os.chdir("/opt/pinarak")

def sh(cmd, tmo=600):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=tmo)
    print("$", " ".join(cmd), "->", r.returncode)
    print((r.stdout or "")[-1500:])
    if r.returncode != 0:
        print("STDERR:", (r.stderr or "")[-1500:])
    return r

def main():
    p = "/opt/pinarak/docker-compose.yml"
    s = open(p).read()
    if "negara-merdu-web:next10" not in s:
        if "negara-merdu-web:next9" not in s:
            print("TAG WEB next9 TAK DITEMUKAN — batal"); return 1
        shutil.copy(p, p + ".bak-next9")
        open(p, "w").write(s.replace("negara-merdu-web:next9", "negara-merdu-web:next10"))
        print("compose: next9 -> next10 (backup .bak-next9)")
    else:
        print("compose sudah next10")

    if sh(["docker", "compose", "pull", "web"]).returncode != 0:
        print("PULL GAGAL — batal"); return 1
    if sh(["docker", "compose", "up", "-d", "web"]).returncode != 0:
        print("UP GAGAL — batal"); return 1
    time.sleep(8)
    sh(["docker", "inspect", "pinarak-web-1", "--format",
        "web image={{.Config.Image}} started={{.State.StartedAt}} status={{.State.Status}}"])
    sh(["docker", "logs", "--tail", "15", "pinarak-web-1"])
    return 0

if __name__ == "__main__":
    sys.exit(main())
