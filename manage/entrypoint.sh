#!/bin/sh
set -e

PG_BIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
PGDATA=/var/lib/fsp/pg

mkdir -p "$PGDATA" /run/postgresql
chown -R postgres:postgres /var/lib/fsp /run/postgresql

FRESH=0
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[fsp] postgres: initdb"
  su postgres -s /bin/sh -c "$PG_BIN/initdb -D $PGDATA -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8" > /dev/null
  FRESH=1
else
  echo "[fsp] postgres: restart"
  rm -f "$PGDATA/postmaster.pid"
fi
su postgres -s /bin/sh -c "$PG_BIN/pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1 -k /run/postgresql' -w start" > /dev/null
if [ "$FRESH" = 1 ]; then
  su postgres -s /bin/sh -c "psql -h /run/postgresql -q -c \"CREATE USER fsp WITH PASSWORD 'fsp'\" -c \"CREATE DATABASE fsp OWNER fsp\""
fi

echo "[fsp] redis: start"
redis-server --daemonize yes --bind 127.0.0.1 --save '' --appendonly no > /dev/null

echo "[fsp] seaweedfs: start"
mkdir -p /var/lib/fsp/seaweed
weed server -dir=/var/lib/fsp/seaweed -ip=127.0.0.1 -ip.bind=0.0.0.0     -master.volumeSizeLimitMB=1024 -volume.max=0     -s3 -s3.port=9000 -s3.config=/etc/fsp/s3.json > /var/log/seaweed.log 2>&1 &

echo "[fsp] mailpit: start"
mailpit --listen 0.0.0.0:8025 --smtp 127.0.0.1:1025 --database /var/lib/fsp/mailpit.db > /var/log/mailpit.log 2>&1 &
python - <<'PY'
import socket
import time
for attempt in range(30):
    try:
        with socket.create_connection(("127.0.0.1", 1025), timeout=1):
            break
    except OSError:
        if attempt == 29:
            raise
        time.sleep(1)
PY

echo "[fsp] schema + seed"
python manage/bootstrap.py

echo "[fsp] api: http://localhost:8000/docs, files: http://localhost:9000"
echo "[fsp] mailpit: http://localhost:8025"
exec uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers
