#!/bin/bash
exec >> /mnt/d/voicestudio/logs/start_vs.log 2>&1
echo "=== START_VS $(date) ==="
echo "--- systemctl/service docker ---"
systemctl start docker 2>&1 || service docker start 2>&1 || (nohup dockerd > /tmp/dockerd.log 2>&1 &)
for i in $(seq 1 20); do
  docker info > /dev/null 2>&1 && { echo "docker UP pada $i"; break; }
  sleep 3
done
docker info > /dev/null 2>&1 || { echo "DOCKER GAGAL"; tail -20 /tmp/dockerd.log 2>/dev/null; exit 1; }
echo "--- docker ps -a ---"
docker ps -a --format '{{.Names}} {{.Status}}'
echo "--- start omnivoice ---"
docker start omnivoice 2>&1 || bash /mnt/d/voicestudio/scripts/run_container.sh
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3900/health 2>/dev/null)
  echo "probe $i health=$code"
  [ "$code" = "200" ] && break
  sleep 5
done
docker ps --filter name=omnivoice --format '{{.Names}} {{.Status}} {{.Ports}}'
echo "=== START_VS DONE $(date) ==="
