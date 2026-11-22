"""Deploy app Go Negara Merdu (binary baru: fasilitas apartemen Blok 2120)
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
    os.makedirs("/opt/pinarak/bak-apartemen", exist_ok=True)
    shutil.copy("/opt/pinarak/pinarak", "/opt/pinarak/bak-apartemen/pinarak.lama")
    os.replace("/opt/pinarak/pinarak.new", "/opt/pinarak/pinarak")
    os.chmod("/opt/pinarak/pinarak", 0o755)
    print("binary diganti (backup di bak-apartemen/pinarak.lama)")
    if sh(["docker", "compose", "build", "app"]).returncode != 0:
        print("BUILD APP GAGAL — batal"); return 1
    if sh(["docker", "compose", "up", "-d", "app"]).returncode != 0:
        print("UP APP GAGAL — batal"); return 1
    time.sleep(6)
    sh(["docker", "inspect", "pinarak-app-1", "--format",
        "app image={{.Image}} started={{.State.StartedAt}} status={{.State.Status}}"])
    sh(["docker", "logs", "--tail", "20", "pinarak-app-1"])
    r = subprocess.run(["curl", "-s", "http://127.0.0.1:8026/api/pembangunan"],
                       capture_output=True, text=True, timeout=30)
    print("API pembangunan (lokal):", r.stdout[:800])
    return 0

if __name__ == "__main__":
    sys.exit(main())
