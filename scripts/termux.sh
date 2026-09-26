#!/data/data/com.termux/files/usr/bin/bash
# ---------------------------------------------------------------------------
# ФАЙЕРПРОМ Metalworks — запуск на Termux (Android / arm64)
#
# Turbopack под android/arm64 не собирается: нативных биндингов нет,
# грузятся только WASM. Поэтому здесь всё идёт через Webpack (--webpack).
#
#   bash scripts/termux.sh doctor   — проверить окружение
#   bash scripts/termux.sh dev      — дев-сервер  (http://localhost:3000)
#   bash scripts/termux.sh build    — прод-сборка
#   bash scripts/termux.sh start    — прод-сервер
#   bash scripts/termux.sh db       — применить схему Drizzle к БД
#   bash scripts/termux.sh check    — типы + сборка (полная проверка)
# ---------------------------------------------------------------------------
set -u

CMD="${1:-help}"
cd "$(dirname "$0")/.." || exit 1

# Телефону не хватает кучи по умолчанию — поднимаем лимит V8
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
# Меньше воркеров = меньше шансов словить OOM на мобильном CPU
export NEXT_CPU_PROF=0

c_ok()   { printf "\033[32m✓\033[0m %s\n" "$1"; }
c_warn() { printf "\033[33m!\033[0m %s\n" "$1"; }
c_err()  { printf "\033[31m✗\033[0m %s\n" "$1"; }
c_head() { printf "\n\033[1m═══ %s ═══\033[0m\n" "$1"; }

ensure_env() {
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      cp .env.example .env
      c_warn "Создан .env из .env.example — впишите DATABASE_URL"
    else
      c_err ".env не найден"
    fi
  fi
}

case "$CMD" in
  doctor)
    c_head "Окружение"
    echo "node:   $(node -v 2>/dev/null || echo 'НЕ УСТАНОВЛЕН')"
    echo "npm:    $(npm -v 2>/dev/null || echo 'НЕ УСТАНОВЛЕН')"
    echo "arch:   $(uname -m)"
    echo "mem:    $(free -m 2>/dev/null | awk '/Mem:/{print $2" MB"}' || echo 'n/a')"

    NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if [ "$NODE_MAJOR" -ge 20 ]; then
      c_ok "Node ${NODE_MAJOR}.x подходит (нужен >= 20)"
    else
      c_err "Нужен Node >= 20: pkg install nodejs-lts"
    fi

    [ -d node_modules ] && c_ok "node_modules на месте" || c_warn "Выполните: npm install"

    ensure_env
    if [ -f .env ] && grep -q '^DATABASE_URL=.\+' .env; then
      c_ok "DATABASE_URL задан"
    else
      c_warn "DATABASE_URL пуст — возьмите строку из Supabase (Settings → Database)"
    fi

    c_head "Сборщик"
    c_warn "Turbopack на android/arm64 недоступен — используется Webpack"
    echo "Собирать: bash scripts/termux.sh build"
    ;;

  dev)
    ensure_env
    c_head "Dev-сервер (webpack)"
    exec npx next dev --webpack
    ;;

  build)
    ensure_env
    c_head "Прод-сборка (webpack)"
    npx next build --webpack
    ;;

  start)
    ensure_env
    if [ ! -d .next ]; then
      c_warn "Сборки нет — собираю"
      npx next build --webpack || exit 1
    fi
    c_head "Прод-сервер"
    exec npx next start
    ;;

  db)
    ensure_env
    c_head "Drizzle push"
    npx drizzle-kit push
    ;;

  check)
    ensure_env
    c_head "Типы"
    npx tsc --noEmit || exit 1
    c_ok "Ошибок типов нет"
    c_head "Сборка (webpack)"
    npx next build --webpack || exit 1
    c_ok "Сборка прошла"
    ;;

  *)
    sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
