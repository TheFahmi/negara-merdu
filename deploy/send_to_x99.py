#!/usr/bin/env python3
"""Kirim file lokal ke X99 via rantai sandbox -> Oracle -> X99 (stdin, base64).

Usage: send_to_x99.py <file_lokal> <path_remote>
"""
import base64, subprocess, sys

VPS = ["ssh", "-i", "/home/hatch/.ssh/tunnel_key",
       "-o", "ProxyCommand=/home/hatch/workspace/cloudflared/proxy_cmd.py 140.245.124.194 22",
       "-o", "ConnectTimeout=25", "-o", "StrictHostKeyChecking=no",
       "ubuntu@140.245.124.194"]

def main():
    src, dst = sys.argv[1], sys.argv[2]
    data = base64.b64encode(open(src, "rb").read())
    remote = f"ssh -o ConnectTimeout=20 -o StrictHostKeyChecking=no root@100.75.143.43 'base64 -d > {dst} && md5sum {dst}'"
    r = subprocess.run(VPS + [remote], input=data, capture_output=True, timeout=300)
    sys.stdout.write(r.stdout.decode())
    sys.stderr.write(r.stderr.decode()[-2000:])
    return r.returncode

if __name__ == "__main__":
    sys.exit(main())
