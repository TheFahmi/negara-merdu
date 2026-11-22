#!/bin/bash
# Desa Pinarak — deploy di X99. Dijalankan SETELAH source diekstrak ke /root/builds/pinarak
# dan three.min.js sudah ada di public/ (diunduh dari cdnjs, md5 diverifikasi orkestrator).
set -e
cd /root/builds/pinarak
mkdir -p data
python3 -m py_compile server.py
echo "[1/6] source OK"

cp deploy/pinarak.service /etc/systemd/system/pinarak.service
echo "[2/6] systemd unit terpasang"

cp deploy/pinarak-desk.yaml /data/coolify/proxy/dynamic/pinarak-desk.yaml
echo "[3/6] traefik dynamic terpasang"

if [ -d /etc/nginx/sites-enabled ]; then
  cp deploy/pinarak.mfah.me.nginx /etc/nginx/sites-enabled/pinarak.mfah.me
  nginx -t 2>&1 | tail -1 || true
fi
echo "[4/6] vhost nginx terpasang (host nginx mati sejak Okt — jalur live via Traefik)"

if ! iptables -C INPUT -p tcp -s 172.19.0.0/16 --dport 8026 -j ACCEPT 2>/dev/null; then
  iptables -I INPUT 5 -p tcp -s 172.19.0.0/16 --dport 8026 -j ACCEPT
  netfilter-persistent save >/dev/null 2>&1 || true
  echo "[5/6] aturan firewall 8026 ditambahkan + disimpan"
else
  echo "[5/6] aturan firewall 8026 sudah ada"
fi

systemctl daemon-reload
systemctl enable pinarak >/dev/null 2>&1
systemctl restart pinarak
sleep 2
systemctl is-active pinarak
systemctl is-enabled pinarak
curl -s -o /dev/null -w "lokal 127.0.0.1:8026 -> %{http_code}\n" http://127.0.0.1:8026/
curl -s http://127.0.0.1:8026/api/statistik
echo
echo "[6/6] deploy selesai"
