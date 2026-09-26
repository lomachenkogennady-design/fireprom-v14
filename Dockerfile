# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# ФАЙЕРПРОМ Metalworks — production image
#
# Подходит для Amvera, ONREZA, RelaxDev, dockerhosting.ru и любого VPS.
# Многоступенчатая сборка + output:"standalone" → финальный образ ~150 МБ,
# работает на тарифах с 0.5 ГБ RAM.
# ---------------------------------------------------------------------------

# ---------- 1. зависимости ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---------- 2. сборка ----------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# На слабых билдерах сборке не хватает кучи по умолчанию
ENV NODE_OPTIONS=--max-old-space-size=2048
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL при сборке не нужен: подключение к БД ленивое.
# Шрифты next/font/google скачиваются здесь — билдеру нужен интернет.
RUN npm run build

# ---------- 3. рантайм ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# standalone уже содержит только нужные модули
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# идемпотентная инициализация схемы БД при старте
COPY --from=builder --chown=nextjs:nodejs /app/scripts/init-db.mjs ./scripts/init-db.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/sql ./scripts/sql

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"

# Схема накатывается при старте (CREATE TABLE IF NOT EXISTS — безопасно),
# затем поднимается сервер. Если DATABASE_URL не задан — просто предупреждение.
CMD ["sh", "-c", "node scripts/init-db.mjs; node server.js"]
