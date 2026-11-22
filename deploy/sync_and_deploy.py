#!/usr/bin/env python3
"""Orkestrator deploy Desa Pinarak dari sandbox -> X99 (via x99.py).
- Source (tanpa three.min.js & data/) dikirim sebagai tar.gz base64 per potongan.
- three.min.js diunduh di X99 dari cdnjs, md5 dicocokkan dengan salinan lokal.
- Lalu deploy_x99.sh dijalankan di X99.
"""
import base64
import hashlib
import io
import subprocess
import sys
import tarfile

X99 = "/home/hatch/workspace/cctv-manual/x99.py"
ROOT = "/home/hatch/workspace/pinarak"
THREE_MD5 = "eb8549863a97355411c3259a3f93b8e1"
CDNJS = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
LEWATI = ("public/three.min.js", "data/", "__pycache__", ".git")


def x99(cmd, timeout=240):
    r = subprocess.run(["python3", X99, cmd, str(timeout)], capture_output=True, text=True, timeout=timeout + 60)
    if r.returncode != 0:
        sys.exit(f"X99 GAGAL ({r.returncode}): {cmd[:80]}...\n{r.stdout[-500:]}\n{r.stderr[-500:]}")
    return r.stdout


def buat_tarball():
    buf = io.BytesIO()
    import os
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = [d for d in dirnames if d not in ("__pycache__", ".git", "data")]
            for fn in filenames:
                penuh = os.path.join(dirpath, fn)
                rel = os.path.relpath(penuh, ROOT)
                if any(rel == l or rel.startswith(l) for l in LEWATI):
                    continue
                tf.add(penuh, arcname=rel)
    return buf.getvalue()


def main():
    print("cek X99:", x99("echo X99_OK && hostname", 90).strip().replace("\n", " "))
    data = buat_tarball()
    md5 = hashlib.md5(data).hexdigest()
    b64 = base64.b64encode(data).decode()
    print(f"tarball {len(data)} byte, md5 {md5}, b64 {len(b64)} char")
    x99("mkdir -p /root/builds && rm -f /root/builds/pinarak.b64 && echo siap")
    POTONG = 60000
    for i in range(0, len(b64), POTONG):
        x99(f"printf %s '{b64[i:i+POTONG]}' >> /root/builds/pinarak.b64")
        print(f"  terkirim {min(i+POTONG, len(b64))}/{len(b64)}")
    out = x99(
        "rm -rf /root/builds/pinarak && mkdir -p /root/builds/pinarak && "
        "base64 -d /root/builds/pinarak.b64 > /root/builds/pinarak.tgz && "
        f"md5sum /root/builds/pinarak.tgz && "
        "tar -xzf /root/builds/pinarak.tgz -C /root/builds/pinarak && "
        f"curl -sL --max-time 90 -o /root/builds/pinarak/public/three.min.js {CDNJS} && "
        "md5sum /root/builds/pinarak/public/three.min.js && ls /root/builds/pinarak",
        300,
    )
    print(out)
    if md5 not in out:
        sys.exit("MD5 tarball tidak cocok di X99 — berhenti")
    if THREE_MD5 not in out:
        sys.exit("MD5 three.min.js tidak cocok di X99 — berhenti")
    print(x99("bash /root/builds/pinarak/deploy/deploy_x99.sh 2>&1", 300))
    print("DEPLOY X99 SELESAI")


if __name__ == "__main__":
    main()
