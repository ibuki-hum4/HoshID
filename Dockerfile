# HoshID のコンテナイメージ。
#
# **ターゲットを2つ持つ。** 用途が違うものを1つのイメージに押し込むと、
# アプリのコンテナに Prisma CLI やシードスクリプトまで載ることになる。
#
#   runner    アプリ本体。Next.js の standalone 出力を node で動かす
#   migrator  マイグレーションと鍵の保守。k8s の Job / initContainer から呼ぶ
#
# どちらも同じビルド成果物から作るので、中身のズレは起きない。
#
# ベースは Debian (slim)。alpine にすると @node-rs/argon2 と sharp が musl 用の
# ビルドを要求するが、glibc 版のほうが実績がある。**認証基盤なので、イメージの
# 小ささよりネイティブモジュールが確実に動くことを取る。**

ARG BUN_VERSION=1.4.2
ARG NODE_VERSION=22

# --- 依存の取得 -------------------------------------------------------------
FROM oven/bun:${BUN_VERSION}-slim AS deps
WORKDIR /app

# lockfile を固定して入れる。CI と手元で解決結果が変わらないようにする。
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- ビルド -----------------------------------------------------------------
FROM oven/bun:${BUN_VERSION}-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# prisma.config.ts が DATABASE_URL を要求する（生成だけで接続はしない）。
# .dockerignore で .env を外しているので、ここで形だけ渡す。
ENV DATABASE_URL=postgres://build:build@build.invalid:5432/build
RUN bunx prisma generate

# next build は lib/auth.ts を評価する。requireEnv が落ちないよう、
# **明らかに偽の値**を渡す。実行時の値はコンテナに渡すものが使われる。
# ページは全て動的なので、この値が出力に焼き込まれることはない。
ENV BETTER_AUTH_URL=http://build.invalid
ENV BETTER_AUTH_SECRET=build-time-placeholder-not-a-real-secret
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# --- アプリ本体 -------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# root で動かさない。標準の node ユーザーを使う。
# WORKDIR は root が作るので、先に所有者を移す。
RUN chown node:node /app
USER node

COPY --chown=node:node --from=build /app/.next/standalone ./
COPY --chown=node:node --from=build /app/.next/static ./.next/static

# standalone のトレースは serverExternalPackages のものを取りこぼすことがある。
# **この2つを消さないこと。** 欠けると `.prisma/client/default` が見つからず、
# /api/auth/* だけが 500 になる（ページは 200 のまま）という分かりにくい形で出る。
COPY --chown=node:node --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
CMD ["node", "server.js"]

# --- マイグレーションと保守 --------------------------------------------------
FROM oven/bun:${BUN_VERSION}-slim AS migrator
WORKDIR /app

ENV NODE_ENV=production

# 実行に必要なものだけ。.next は要らない。
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY package.json bun.lock tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY lib ./lib
COPY scripts ./scripts

# マイグレーションの適用と、鍵の保守（期限の設定・再暗号化・古い行の削除）。
# どれもべき等なので、デプロイのたびに実行してよい。
CMD ["bun", "run", "deploy:prepare"]
