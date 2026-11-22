#!/usr/bin/env python3
"""Ambil file dari X99 ke lokal via rantai sandbox -> Oracle -> X99 (base64).

Usage: pull_from_x99.py <path_remote> <file_lokal>
"""
import base64, subprocess, sys

VPS = ["ssh", "-i", "/home/hatch/.ssh/tunnel_key",
       "-o", "ProxyCommand=/home/hatch/workspace/cloudflared/proxy_cmd.py 140.245.124.194 22",
       "-o", "ConnectTimeout=25", "-o", "StrictHostKeyChecking=no",
       "ubuntu@140.245.124.194"]

def main():
    src, dst = sys.argv[1], sys.argv[2]
    remote = f"ssh -o ConnectTimeout=20 -o StrictHostKeyChecking=no root@100.75.143.43 'base64 -w0 {src}; md5sum {src} 1>&2'"
    r = subprocess.run(VPS + [remote], capture_output=True, timeout=600)
    sys.stderr.write(r.stderr.decode()[-500:])
    open(dst, "wb").write(base64.b64decode(r.stdout.strip()))
    return r.returncode

if __name__ == "__main__":
    sys.exit(main())
