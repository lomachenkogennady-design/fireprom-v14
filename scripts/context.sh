#!/data/data/com.termux/files/usr/bin/bash
# Генератор CONTEXT.md — единого документа для старта новой сессии ИИ.
#
# Запуск: bash ~/fireprom-v14/scripts/context.sh
# Результат: ~/CONTEXT.md (не в git — содержит реквизиты компании)
#
# CONTEXT.md отличается от docs/PROJECT_STATE.md:
#   PROJECT_STATE.md — история изменений, растёт (в git)
#   CONTEXT.md — снимок «сейчас», пересобирается, локально

set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="$HOME/CONTEXT.md"

{
echo "# FireProM v14 — полный контекст для новой сессии ИИ"
echo ""
echo "> Сгенерировано: $(date '+%d.%m.%Y %H:%M')"
echo "> Репозиторий: $ROOT"
echo "> Регенерация: bash scripts/context.sh"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ПРОЕКТ"
echo "═══════════════════════════════════════════════════════"
echo "MES для ООО «ФАЙЕРПРОМ» (металлообработка, СПб)."
echo "Модули: гибка, резка, КП, станки, история, Jarvis, MES, PDF-КП."
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  АРХИТЕКТУРА"
echo "═══════════════════════════════════════════════════════"
echo "Samsung (u0_a624, пульт):  браузер + SSH, ничего не хостит"
echo "Doogee  (u0_a304, сервер):  Next.js :3000, Postgres :5432,"
echo "                            Ollama :11434, Flask :5001, SSH :8022"
echo "Wi-Fi: http://192.168.10.21:3000"
echo "SSH:   ssh -p 8022 u0_a304@192.168.10.21"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  СТЕК"
echo "═══════════════════════════════════════════════════════"
echo "- Next.js 16.2.6 (App Router, output: standalone)"
echo "- TypeScript 5.9 strict"
echo "- Drizzle ORM 0.45 + Postgres 18"
echo "- Tailwind 4, Three.js, lucide-react"
echo "- Ollama qwen3:4b (Jarvis LLM)"
echo "- pdfkit + DejaVu Sans (PDF-КП)"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  РЕКВИЗИТЫ КОМПАНИИ"
echo "═══════════════════════════════════════════════════════"
if [ -f src/lib/company.ts ]; then
  echo '```ts'
  cat src/lib/company.ts
  echo '```'
else
  echo "(src/lib/company.ts не найден)"
fi
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  СТРУКТУРА (файлы проекта, без node_modules)"
echo "═══════════════════════════════════════════════════════"
echo '```'
git ls-files | grep -vE '^fonts/|\.png$|\.jpg$|\.pdf$|\.ico$' | sort
echo ""
echo "── fonts/ (бинарники) ──"
ls -lh fonts/ 2>/dev/null | tail -5 || echo "(нет)"
echo '```'
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  КЛЮЧЕВЫЕ ФАЙЛЫ"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "── src/lib/theme.ts (авто-тема по URL) ──"
echo '```ts'
sed -n '/export const THEME_FOR_PATH/,/^];/p' src/lib/theme.ts 2>/dev/null || echo "(нет)"
echo '```'
echo ""
echo "── src/db/schema.ts (таблицы) ──"
echo '```ts'
grep -E '^export const [a-z].*= pgTable' src/db/schema.ts 2>/dev/null || echo "(нет)"
echo '```'
echo ""
echo "── src/lib/jarvis/mes.ts (MES-интенты) ──"
echo '```ts'
grep -nE '^export|^async function|^function|regex|test\(' src/lib/jarvis/mes.ts 2>/dev/null | head -20 || echo "(нет)"
echo '```'
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  API-РОУТЫ"
echo "═══════════════════════════════════════════════════════"
find src/app/api -name "route.ts" 2>/dev/null | sed 's|src/app||;s|/route.ts||' | sort
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  СТРАНИЦЫ"
echo "═══════════════════════════════════════════════════════"
find src/app -name "page.tsx" 2>/dev/null | sed 's|src/app||;s|/page.tsx||;s|^$|/|' | sort
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  БД app_db — таблицы"
echo "═══════════════════════════════════════════════════════"
psql -h 127.0.0.1 -U u0_a304 -d app_db -tAc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename" 2>/dev/null | sed 's/^/  /' || echo "(БД недоступна)"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  GIT"
echo "═══════════════════════════════════════════════════════"
echo "HEAD: $(git log --oneline -1)"
echo ""
echo "Последние 10 коммитов:"
git log --oneline -10 | sed 's/^/  /'
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  СЕРВИСЫ (проверка)"
echo "═══════════════════════════════════════════════════════"
echo "Прод:     $(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:3000/api/health 2>/dev/null || echo 'down')"
echo "Postgres: $(pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null && echo 'ok' || echo 'down')"
echo "Ollama:   $(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:11434/api/tags 2>/dev/null || echo 'down')"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ПОДВОДНЫЕ КАМНИ"
echo "═══════════════════════════════════════════════════════"
echo "• Turbopack на ARM → только --webpack"
echo "• Юзер БД = u0_a304 (НЕ postgres!)"
echo "• db.execute() в pg → { rows: [...] }, не массив"
echo "• drizzle-kit push требует TTY → накат через psql"
echo "• Heredoc: всегда << 'EOF' в кавычках"
echo "• Вложенные heredoc рвутся → через python3 file.py"
echo "• Не путать Samsung (u0_a624) и Doogee (u0_a304)"
echo "• На Termux нет /tmp → TMPDIR=/data/data/com.termux/files/usr/tmp"
echo "• pdfkit: serverExternalPackages + fonts/ в standalone"
echo "• PDF-шрифты: DejaVu Sans в fonts/ (1.4 МБ, в git)"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  КОМАНДЫ"
echo "═══════════════════════════════════════════════════════"
echo "Проверка прода:"
echo "  curl -s http://192.168.10.21:3000/api/health"
echo ""
echo "Бэкап:"
echo "  bash ~/fireprom-v14/scripts/backup.sh"
echo ""
echo "Тесты:"
echo "  cd ~/fireprom-v14 && npm test"
echo ""
echo "Сборка + перезапуск — в ~/SESSION_START.md"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ЗАДАЧА НА СЕССИЮ"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "<замени эту строку на конкретную задачу>"
} > "$OUT"

LINES=$(wc -l < "$OUT")
SIZE=$(du -h "$OUT" | cut -f1)
echo "✓ CONTEXT.md создан: $OUT"
echo "  Строк: $LINES"
echo "  Размер: $SIZE"
echo ""
echo "Скопировать на Samsung:"
echo "  scp -P 8022 u0_a304@192.168.10.21:~/CONTEXT.md ~/"

# Авто-копия в общую память (для Samsung без Termux)
cp "$OUT" /sdcard/Documents/fireprom-context.md 2>/dev/null || true
