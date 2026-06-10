FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
COPY prisma ./prisma

ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://dummy:dummy@localhost/dummy"
# ビルド時のページデータ収集で lib/auth.ts が評価されるためダミー値が必要。
# 実際の値は実行時に Secret から注入される（Dockerfile には実値を含めない）。
ENV BETTER_AUTH_SECRET="dummy-build-time-secret-not-used-at-runtime"

RUN bunx prisma generate --schema=prisma/schema.prisma
RUN bun run build

# standalone 出力には Prisma CLI が含まれないため、マイグレーション実行用に
# node_modules と prisma/ を保持した専用ステージを用意する
FROM oven/bun:1.3.14-alpine AS migrator
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/prisma ./prisma
COPY --from=builder --chown=bun:bun /app/package.json ./package.json

USER bun

CMD ["bunx", "prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"]

FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static

USER bun

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD bun run healthcheck || exit 1

CMD ["bun", "run", "start"]
