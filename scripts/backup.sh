#!/data/data/com.termux/files/usr/bin/bash
set -e
TS=$(date +%Y%m%d-%H%M)
HOME_DIR=/data/data/com.termux/files/home
SRC="$HOME_DIR/fireprom-v14"
DB_USER="u0_a304"
DB_NAME="app_db"
ARCHIVE_NAME="fireprom-v14-${TS}.tar.gz"
DUMP_NAME="app_db-${TS}.dump"
OUTPUT_DIR="$HOME_DIR/backups"

echo "═══════════════════════════════════════════════════"
echo "  FIREPROMP v14 — БЭКАП от $TS"
echo "═══════════════════════════════════════════════════"
echo ""

echo "▶ 1. Упаковка кода..."
mkdir -p "$OUTPUT_DIR"
cd "$SRC"
tar -czf "$OUTPUT_DIR/${ARCHIVE_NAME}" \
  --exclude='node_modules' \
  --exclude='node_modules/*' \
  --exclude='.next' \
  --exclude='.next/*' \
  --exclude='.next.*' \
  --exclude='.next.*/*' \
  --exclude='.git/objects' \
  --exclude='.git/objects/*' \
  --exclude='.git/logs' \
  --exclude='.git/logs/*' \
  --exclude='*.bak' \
  --exclude='*.bak-*' \
  --exclude='*.bak2-*' \
  --exclude='*.log' \
  --exclude='tsconfig.tsbuildinfo' \
  .
SIZE=$(du -h "$OUTPUT_DIR/${ARCHIVE_NAME}" | cut -f1)
FILES=$(tar -tzf "$OUTPUT_DIR/${ARCHIVE_NAME}" | wc -l)
NM=$(tar -tzf "$OUTPUT_DIR/${ARCHIVE_NAME}" | grep -c "node_modules" || echo 0)
NX=$(tar -tzf "$OUTPUT_DIR/${ARCHIVE_NAME}" | grep -cE "\.next" || echo 0)
echo "  ✓ ${ARCHIVE_NAME} — ${SIZE}, ${FILES} файлов"
echo "  node_modules внутри: ${NM}"
echo "  .next внутри: ${NX}"

echo ""
echo "▶ 2. Дамп Postgres..."
pg_dump -h 127.0.0.1 -p 5432 -U "$DB_USER" -Fc "$DB_NAME" > "$OUTPUT_DIR/${DUMP_NAME}"
DUMP_SIZE=$(du -h "$OUTPUT_DIR/${DUMP_NAME}" | cut -f1)
TABLES=$(pg_restore --list "$OUTPUT_DIR/${DUMP_NAME}" 2>/dev/null | grep -c "TABLE DATA" || echo "?")
echo "  ✓ ${DUMP_NAME} — ${DUMP_SIZE}, ${TABLES} таблиц"

cp "$SRC/docs/PROJECT_STATE.md" "$OUTPUT_DIR/PROJECT_STATE-${TS}.md" 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ГОТОВО"
echo "═══════════════════════════════════════════════════"
ls -lht "$OUTPUT_DIR" | head -8
