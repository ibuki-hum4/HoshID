// Prisma 7 の設定ファイルは .env を自動で読まない。CLI は Node で動くため
// bun の .env 読み込みも届かないので、ここで明示的に読む。
// .env が無くても失敗しない（本番は実環境変数で渡す）。
import "dotenv/config";

import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 では datasource の `url` を schema.prisma に書けなくなった。
 * マイグレーションとイントロスペクションが使う接続情報はここに置き、
 * 実行時の接続は PrismaClient に渡すドライバアダプタ（lib/prisma.ts）が担う。
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // seed は設定しない。初期データは目的別に分かれていて、どちらも
    // 環境変数で中身を指定する（`bun run seed:admin` / `bun run seed:client`）。
    // ひとつの seed にまとめると、何が作られるか分からないまま走る。
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
