"""Deploy app Go Negara Merdu (binary baru: fitur atur ulang PIN via DM)
DI Hostinger — via host_exec.py. Binary baru harus sudah ada di
/opt/pinarak/pinarak.new (ditransfer terpisah dari X99)."""
import subprocess, sys, time, os, shutil

os.chdir("/opt/pinarak")

def sh(cmd, tmo=600):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=tmo)
    print("$", " ".join(cmd), "->", r.returncode)
    print((r.stdout or "")[-1200:])
    if r.returncode != 0:
        print("STDERR:", (r.stderr or "")[-1200:])
    return r

def main():
    if not os.path.exists("/opt/pinarak/pinarak.new"):
        print("pinarak.new TIDAK ADA — batal"); return 1
    os.makedirs("/opt/pinarak/bak-resetpin", exist_ok=True)
    shutil.copy("/opt/pinarak/pinarak", "/opt/pinarak/bak-resetpin/pinarak.lama")
    os.replace("/opt/pinarak/pinarak.new", "/opt/pinarak/pinarak")
    os.chmod("/opt/pinarak/pinarak", 0o755)
    print("binary diganti (backup di bak-resetpin/pinarak.lama)")
    if sh(["docker", "compose", "build", "app"]).returncode != 0:
        print("BUILD APP GAGAL — batal"); return 1
    if sh(["docker", "compose", "up", "-d", "app"]).returncode != 0:
        print("UP APP GAGAL — batal"); return 1
    time.sleep(6)
    sh(["docker", "inspect", "pinarak-app-1", "--format",
        "app image={{.Image}} started={{.State.StartedAt}} status={{.State.Status}}"])
    sh(["docker", "logs", "--tail", "20", "pinarak-app-1"])
    r = subprocess.run(["curl", "-s", "-X", "POST", "http://127.0.0.1:8026/api/reset-pin",
                        "-H", "Content-Type: application/json", "-d", "{}"],
                       capture_output=True, text=True, timeout=30)
    print("API reset-pin (lokal, username kosong -> generik):", r.stdout[:300])
    r = subprocess.run(["curl", "-s", "http://127.0.0.1:8026/api/reset-pin/status?sesi=tidakada"],
                       capture_output=True, text=True, timeout=30)
    print("API reset-pin/status (lokal, sesi tak dikenal -> 404):", r.stdout[:300])
    r = subprocess.run(["curl", "-s", "http://127.0.0.1:8026/api/statistik"],
                       capture_output=True, text=True, timeout=30)
    print("API statistik (lokal):", r.stdout[:300])
    return 0

if __name__ == "__main__":
    sys.exit(main())
