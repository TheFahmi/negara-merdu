#!/usr/bin/env python3
"""Jembatan TCP lokal -> proxy CONNECT (alienware-ssh/proxy.py) -> Alienware:9333.
SSH -L gagal (channel kosong), jadi tiap koneksi lokal diteruskan lewat
subproses proxy.py yang membuka CONNECT ke 100.68.164.32:9333."""
import socket, subprocess, sys, threading

LISTEN = 19334
PROXY = ["python3", "/home/hatch/workspace/alienware-ssh/proxy.py", "100.68.164.32", "9333"]


def relay(src_get, dst_put, done):
    try:
        while True:
            data = src_get(65536)
            if not data:
                break
            dst_put(data)
    except Exception:
        pass
    finally:
        done()


def handle(conn):
    proc = subprocess.Popen(PROXY, stdin=subprocess.PIPE, stdout=subprocess.PIPE)

    def close_all():
        try:
            conn.close()
        except Exception:
            pass
        try:
            proc.kill()
        except Exception:
            pass

    t1 = threading.Thread(target=relay, args=(lambda n: conn.recv(n), lambda d: (proc.stdin.write(d), proc.stdin.flush()), close_all), daemon=True)
    t2 = threading.Thread(target=relay, args=(lambda n: proc.stdout.read1(n) if hasattr(proc.stdout, 'read1') else proc.stdout.read(n), lambda d: conn.sendall(d), close_all), daemon=True)
    t1.start(); t2.start()


srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(("127.0.0.1", LISTEN))
srv.listen(8)
print("forwarder siap di", LISTEN, flush=True)
while True:
    c, _ = srv.accept()
    threading.Thread(target=handle, args=(c,), daemon=True).start()
