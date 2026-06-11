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
# NEXT_PUBLIC_* はビルド時に静的展開され、サーバー側コード（lib/auth.ts の
# better-auth baseURL、OIDC issuer、確認メールのリンク生成等）にも埋め込まれる。
# 実行時の Pod 環境変数では上書きされないため、本番URLをここで指定する。
ENV NEXT_PUBLIC_APP_URL="https://hoshid.skyia.jp"

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
COPY --from=builder --chown=bun:bun /app/prisma.config.ts ./prisma.config.ts

USER bun

CMD ["bunx", "prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"]

# OIDC JWK ローテーション CronJob 用ステージ。
# scripts/rotate-oidc-jwk.mjs が @kubernetes/client-node 経由で
# hoshid-secrets Secret と frontend Deployment を更新する。
FROM oven/bun:1.3.14-alpine AS jwk-rotator
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/scripts ./scripts
COPY --from=builder --chown=bun:bun /app/package.json ./package.json

USER bun

CMD ["bun", "run", "scripts/rotate-oidc-jwk.mjs"]

FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/.next ./.next
COPY --from=builder --chown=bun:bun /app/package.json ./package.json
COPY --from=builder --chown=bun:bun /app/next.config.ts ./next.config.ts

USER bun

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD bun run healthcheck || exit 1

CMD ["bun", "run", "start"]