#!/data/data/com.termux/files/usr/bin/bash
# Бэкап app_db с ротацией 30 дней
set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
LABEL="${1:-scheduled}"
BASE=$HOME/backups
mkdir -p "$BASE"

# Дамп
pg_dump -U u0_a304 app_db | gzip > "$BASE/app_db-$LABEL-$TS.sql.gz"

# Размер
SIZE=$(du -h "$BASE/app_db-$LABEL-$TS.sql.gz" | cut -f1)

# Ротация: удалить старше 30 дней
find "$BASE" -name 'app_db-*.sql.gz' -mtime +30 -delete

echo "[$TS] backup done: app_db-$LABEL-$TS.sql.gz ($SIZE)"
