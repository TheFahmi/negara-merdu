#!/usr/bin/env python3
"""Alihkan DNS pinarak.mfah.me SEMENTARA ke Oracle (halaman coming soon).
Dijalankan DI ORACLE. Kredensial dibaca dari /etc/letsencrypt/cloudflare.ini
(format certbot: dns_cloudflare_email + dns_cloudflare_api_key = Global API
Key). Nilai kredensial TIDAK pernah dicetak.

Mengubah record yang ada (id c3f62bb49743afa819948f525cbb9735) dari
CNAME -> tunnel X99 menjadi A -> 140.245.124.194, proxied=true.
RESTORE: kembalikan type=CNAME content=19eedf11-5822-45cd-8b78-6c5f51ff4f18.cfargotunnel.com
(atau jalankan ulang dns_pinarak.py setelah record dihapus).
"""
import json
import re
import sys
import urllib.request

INI = "/etc/letsencrypt/cloudflare.ini"
ZONE = "da43d82cf5aa29f363245c230808d094"  # mfah.me
NAME = "pinarak.mfah.me"
IP_ORACLE = "140.245.124.194"


def baca_ini():
    teks = open(INI).read()
    email = re.search(r"dns_cloudflare_email\s*=\s*(\S+)", teks)
    key = re.search(r"dns_cloudflare_api_key\s*=\s*(\S+)", teks)
    if not email or not key:
        sys.exit("Format cloudflare.ini tidak dikenali (email/api_key tidak ketemu)")
    return email.group(1), key.group(1)


def api(method, url, headers, data=None):
    req = urllib.request.Request(url, method=method, headers=headers,
                                 data=json.dumps(data).encode() if data else None)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    email, key = baca_ini()
    h = {"X-Auth-Email": email, "X-Auth-Key": key, "Content-Type": "application/json"}
    base = f"https://api.cloudflare.com/client/v4/zones/{ZONE}/dns_records"
    ada = api("GET", base + f"?name={NAME}", h)
    if not ada.get("result"):
        sys.exit("Record pinarak tidak ditemukan")
    rec = ada["result"][0]
    print(f"SEBELUM: {rec['type']} {rec['name']} -> {rec['content']} proxied={rec['proxied']} id={rec['id']}")
    if rec["type"] == "A" and rec["content"] == IP_ORACLE:
        print("SUDAH A ke Oracle, tidak diubah.")
        return
    diubah = api("PUT", f"{base}/{rec['id']}", h,
                 {"type": "A", "name": "pinarak", "content": IP_ORACLE, "proxied": True, "ttl": 1})
    r2 = diubah["result"]
    print(f"SESUDAH: {r2['type']} {r2['name']} -> {r2['content']} proxied={r2['proxied']} id={r2['id']}")


if __name__ == "__main__":
    main()
