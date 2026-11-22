#!/usr/bin/env python3
"""Jalankan skrip Python DI Hostinger lewat SSH double-hop (sandbox -> Oracle -> Hostinger).

Skrip dibaca dari stdin sandbox dan diteruskan sebagai stdin ke `python3 -`
di Hostinger — tanpa quoting shell sama sekali (fish-safe). Argumen skrip
boleh diberikan sesudah `--`.

Pakai: python3 host_exec.py < skrip.py
       cat skrip.py | python3 host_exec.py
Output Hostinger diteruskan apa adanya; exit code mengikuti skrip remote.
"""
import subprocess
import sys

PROXY = "/home/hatch/workspace/cloudflared/proxy_cmd.py"


def main() -> int:
    script = sys.stdin.buffer.read()
    if not script.strip():
        print("host_exec: stdin kosong, tidak ada skrip untuk dijalankan", file=sys.stderr)
        return 2
    inner = ["ssh", "-o", "StrictHostKeyChecking=accept-new",
             "-o", "ConnectTimeout=15",
             "root@76.13.197.226", "python3", "-"]
    outer = ["ssh", "-o", f"ProxyCommand={PROXY} %h %p",
             "-i", "/home/hatch/.ssh/tunnel_key",
             "-o", "StrictHostKeyChecking=accept-new",
             "ubuntu@140.245.124.194"] + inner
    p = subprocess.run(outer, input=script, capture_output=True, timeout=300)
    sys.stdout.buffer.write(p.stdout)
    sys.stderr.buffer.write(p.stderr)
    return p.returncode


if __name__ == "__main__":
    sys.exit(main())
