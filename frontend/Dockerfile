FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
COPY prisma ./prisma

ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://dummy:dummy@localhost/dummy"

RUN bunx prisma generate --schema=prisma/schema.prisma
RUN bun run build

FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD bun run healthcheck || exit 1

CMD ["bun", "run", "start"]
