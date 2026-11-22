#!/usr/bin/env python3
"""Buat CNAME pinarak.mfah.me via Cloudflare API. Dijalankan DI ORACLE.
Kredensial dibaca dari /etc/letsencrypt/cloudflare.ini (format certbot:
dns_cloudflare_email + dns_cloudflare_api_key = Global API Key).
Nilai kredensial TIDAK pernah dicetak.
"""
import json
import re
import sys
import urllib.request

INI = "/etc/letsencrypt/cloudflare.ini"
ZONE = "da43d82cf5aa29f363245c230808d094"  # mfah.me (sama seperti fibo)
TARGET = "19eedf11-5822-45cd-8b78-6c5f51ff4f18.cfargotunnel.com"  # tunnel merdu-lb
NAME = "pinarak.mfah.me"


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
    if ada.get("result"):
        rec = ada["result"][0]
        print(f"SUDAH ADA: {rec['type']} {rec['name']} -> {rec['content']} proxied={rec['proxied']} id={rec['id']}")
        return
    dibuat = api("POST", base, h, {"type": "CNAME", "name": "pinarak", "content": TARGET, "proxied": True, "ttl": 1})
    rec = dibuat["result"]
    print(f"TERBUAT: {rec['type']} {rec['name']} -> {rec['content']} proxied={rec['proxied']} id={rec['id']}")


if __name__ == "__main__":
    main()
