#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock

# ── Postgres ──
pg_isready -h 127.0.0.1 -p 5432 -q >/dev/null 2>&1 || \
  pg_ctl -D $PREFIX/var/lib/postgresql -l /data/data/com.termux/files/home/postgres.log start

i=0
while [ $i -lt 30 ]; do
  pg_isready -h 127.0.0.1 -p 5432 -q >/dev/null 2>&1 && break
  sleep 1
  i=$((i+1))
done

# ── Next.js portal (production standalone) ──
[ -f /data/data/com.termux/files/home/fireprom.pid ] && \
  kill $(cat /data/data/com.termux/files/home/fireprom.pid) 2>/dev/null
sleep 1

cd /data/data/com.termux/files/home/fireprom-v14/.next/standalone
PORT=3000 HOSTNAME=0.0.0.0 NODE_ENV=production \
  nohup node server.js > /data/data/com.termux/files/home/next.log 2>&1 &
echo $! > /data/data/com.termux/files/home/fireprom.pid
