# CLAUDE.md

HoshID は自前の **OpenID Connect Provider（IdP）**。ユーザーが自分のサービス群を RP としてぶら下げるための一次認証基盤で、外部 IdP へのフェデレーションは行わない（HoshID 自身がアイデンティティの源）。

**このリポジトリは認証基盤である。** 認可コードの扱い、トークン発行、リダイレクト先の検証を「動けばいい」で書かない。仕様に迷ったら推測せず、後述の一次情報を読むこと。

---

## 最重要: 訓練データと現実がズレている箇所

ここを読まずにコードを書くと、ほぼ確実に古い書き方をする。

### Next.js 16（2025-10 リリース / 現在 16.3.5）

| 項目 | 訓練データにありがちな古い形 | **Next 16 の正解** |
|---|---|---|
| ミドルウェア | `middleware.ts` / `export function middleware()` | **`proxy.ts` / `export function proxy()`**。Node ランタイム固定、edge 非対応 |
| `params` / `searchParams` | 同期アクセス `params.slug` | **`await params`** 必須。同期アクセスは 15 の互換期間を経て**完全撤廃** |
| `cookies()` / `headers()` / `draftMode()` | 同期 | **全て `await` 必須** |
| リント | `next lint` | **削除済み**。`eslint .` を直接叩く。`next build` はリントしない |
| バンドラ | `--turbopack` を付ける | **Turbopack が既定**。付ける必要なし。webpack に戻すのは `--webpack` |
| Turbopack 設定 | `experimental.turbopack` | **トップレベル `turbopack`** |
| `revalidateTag` | `revalidateTag('tag')` | **`revalidateTag('tag', 'max')`** — 第2引数に cacheLife プロファイル必須。単一引数は非推奨で型エラー |
| 即時反映 | `revalidatePath` 等 | Server Action 内なら **`updateTag()`**（read-your-writes）/ **`refresh()`**（キャッシュ非依存データのみ） |
| `cacheLife` / `cacheTag` | `unstable_` プレフィックス | **stable 化済み**。`import { cacheLife, cacheTag } from 'next/cache'` |
| PPR | `experimental.ppr` | **削除**。`cacheComponents: true` に統合（本プロジェクトでは未使用） |
| ランタイム設定 | `serverRuntimeConfig` / `publicRuntimeConfig` | **削除**。環境変数を使う。実行時読み取りは `connection()` を先に呼ぶ |
| 並行ルート | 暗黙のフォールバック | 全スロットに **明示的な `default.js`** が必須。無いとビルド失敗 |

その他 Next 16 で効いてくる点:

- **Node.js 20.9+ / TypeScript 5.1+** が最低要件。
- `next dev` の出力は `.next/dev`。`next dev` と `next build` は別ディレクトリなので並行実行できるが、**同一プロジェクトで `next dev` の多重起動はロックファイルで防止される**。
- 型ヘルパは `next typegen` が生成する。ページは `PageProps<'/path'>`、レイアウトは `LayoutProps<'/path'>`、Route Handler は `RouteContext<'/path'>` を使う。
- `next build` の出力から `size` / `First Load JS` は削除された。
- `next dev` 実行時、`process.argv` に `'dev'` は**含まれない**（`next.config.ts` 内で分岐している場合は `NODE_ENV` を見る）。
- `tsconfig.json` の `jsx` は **`react-jsx` 固定**。`preserve` を書いても `next typegen` / `next build` が書き換える（React automatic runtime 必須化）。戻さないこと。
- `next/image` の既定値が変わった: `qualities` は `[75]` のみ、`minimumCacheTTL` は 4時間、`imageSizes` から `16` が削除、リダイレクトは最大3回、ローカルIPの最適化はブロック。

**Next 16 の一次情報は `node_modules/next/dist/docs/` にバンドルされている。** ウェブ検索より先にここを読むこと（`next dev` が `AGENTS.md` にこの案内を自動で書き戻す）。

### Better Auth（現在 1.7.5）

- **`oidc-provider` プラグインは 2026-06 に廃止・削除済み。** ネット上の記事やブログはほぼ全て `oidcProvider()` を使っているが、**追随しないこと**。
- 現行は **`@better-auth/oauth-provider` の `oauthProvider()`**（OAuth 2.1 Provider）。これが OIDC Provider の役割も担う（`openid` スコープで OIDC クレームが有効になる）。
- JWKS は別プラグイン **`jwt()`**（`better-auth/plugins`）が提供する。`oauthProvider()` 単体では JWKS が出ない。
- `jwt()` の `/token` エンドポイントは OAuth の `/oauth2/token` と紛らわしいので、`disabledPaths: ["/token"]` で殺してある。
- **CLI のパッケージ名は `auth`。** 旧 `@better-auth/cli` は 1.4.21 で更新が止まっている。スキーマ生成は `bunx auth@1.7.5 generate`。

### Prisma 7

- **datasource に `url` を書けない。** v7 で廃止された。マイグレーション用の接続情報は **`prisma.config.ts`** に置き、実行時の接続はドライバアダプタが担う。`schema.prisma` の `datasource` は `provider` だけ。
- **`prisma.config.ts` は `.env` を自動で読まない。** Prisma CLI は Node で動くので bun の `.env` 読み込みも届かない。設定ファイル冒頭の `import "dotenv/config"` を消さないこと。
- **`new PrismaClient()` を引数なしで呼べない。** v7 で内蔵の接続エンジンが削除され、**ドライバアダプタが必須**になった。PostgreSQL では `@prisma/adapter-pg` を使う:
  ```ts
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  ```
  ドライバアダプタは node-postgres のプール設定をそのまま使う。**node-postgres の接続タイムアウトは既定で無制限**（Prisma 6 は 5秒だった）なので、`connectionTimeoutMillis` を明示しないと DB が落ちている時にリクエストが永久に待つ。
- **`prisma` パッケージの `latest` タグは RC（8.0.0-rc）を指している。** `bun add prisma` をそのまま打つと RC が入る。`prisma` と `@prisma/client` は**必ず同一バージョン**にすること（現在 7.10.0 で固定）。
- **Next 16 + Turbopack で `Cannot find module '.prisma/client/default'` が出る。** `next.config.ts` の `serverExternalPackages` と `turbopack.resolveAlias` で対処済み。**この2つを消さないこと。**
  - 併せて `schema.prisma` の generator は `provider = "prisma-client-js"` のままにし、`output` を足さない。`prisma-client` プロバイダに変えると再発する。
  - ネット上の記事は `experimental.turbo` に書いているが、**Next 16 ではトップレベル `turbopack`**。

### ツールチェインの既知の罠

- **TypeScript は 6.0.3 で固定。7 に上げない。** `eslint-config-next@16.3.5` → `typescript-eslint@8` の peer が `typescript >=4.8.4 <6.1.0`。TS 7.0.2 は範囲外で lint が壊れる。（TS 6.0 には 6.0.2 / 6.0.3 という安定版がある。5.x に落とす必要はない。）
- **ESLint 10 + `eslint-plugin-react@7` は、React バージョンの自動検出でクラッシュする。**
  `TypeError: contextOrFilename.getFilename is not a function` が出たらこれ。`eslint.config.mjs` の `settings: { react: { version: "19.3.0" } }` で自動検出をスキップさせて回避している。**この設定を消さないこと。** React を上げたらこの値も追随させる。

---

## コマンド

```bash
bun install                # 依存インストール

bun run db:up              # Podman で PostgreSQL を起動
bun run db:down            # 停止

bun run auth:schema        # auth.ts の構成から prisma/schema.prisma を再生成
bun run db:migrate         # マイグレーション作成＋適用（開発用）
bun run db:deploy          # 既存マイグレーションの適用のみ（本番 / CI）
bun run db:generate        # Prisma Client を再生成
bun run db:studio          # Prisma Studio

bun run typecheck          # next typegen && tsc --noEmit
bun run lint               # eslint .
bun run build              # next build（Turbopack）
```

**`bun run dev` を勝手に起動しない。** ユーザーが自分で dev サーバを回している場合があり、`.next` を共有すると衝突する。動作確認で起動が必要になったら、まず一声かけること。

---

## 構成

**`src/` ディレクトリは使わない。** `app/` をプロジェクト直下に置く。インポートエイリアス `@/*` はリポジトリルートを指す（`@/lib/auth` = `lib/auth.ts`）。

```
app/
  api/auth/[...all]/route.ts   Better Auth ハンドラ（GET/POST）
  (auth)/                      認証画面のルートグループ（共通 Card レイアウト）
    sign-in/                   ログイン
    apply/                     アカウント申請（sign-up は存在しない）
    pending/  rejected/        未承認ユーザー向けの状態表示
    consent/                   同意画面
  admin/applications/          申請の一覧・承認・却下（M2）
  layout.tsx  page.tsx  globals.css
components/ui/                 shadcn/ui（生成物だが自分のコード。手を入れてよい）
prisma/
  schema.prisma                ★ Better Auth 由来のモデルは手書きしない。auth:schema で生成
  migrations/                  prisma migrate の生成物
lib/
  prisma.ts                    PrismaClient（@prisma/adapter-pg 必須）
  auth.ts                      Better Auth 本体（全プラグイン構成）
  auth-client.ts               createAuthClient（React 用）
  permissions.ts               createAccessControl によるロール定義（admin / officer）
  mail.ts                      承認・却下メールの送信（M2）
  scopes.ts                    スコープ → 日本語説明のマップ
  utils.ts                     cn()
scripts/
  seed-admin.ts                初代管理者を承認済みで作成（これが無いと全員 pending で詰む）
  seed-client.ts               初回 OAuth クライアント登録
  test-rp/                     openid-client による検証用 RP（ポート 4000）
k8s/                           Deployment / Service / Ingress / migration Job
compose.dev.yaml               dev 用 PostgreSQL（Podman）
```

`prisma/schema.prisma` のうち Better Auth 由来のモデルは `auth:schema` の生成物。テーブルを増やしたくなったら `lib/auth.ts` のプラグイン構成を変えて再生成する。手で書いたモデルは残るが、生成対象のモデルを直接編集すると次の生成で上書きされる。

---

## アカウント申請フロー

**HoshID は誰でも自由にアカウントを作れる IdP ではない。** サインアップは「申請」であり、最高権限保持者（`admin` / `officer`＝役員）の承認を経て初めて利用可能になる。

```
申請 → pending ──承認──→ approved   ログイン可能。承認メールを送信
                └─却下──→ rejected   ログイン不可
```

- `user.status` は `pending | approved | rejected`。`/sign-up` は存在せず `/apply` が申請フォーム。
- **`status` をクライアント入力から設定させない。** `user.additionalFields` の `input: false` と `databaseHooks.user.create.before` による上書きの**二重防御**。片方でも外すと、申請 API に `status: "approved"` を混ぜるだけで承認を自称できる。
- **未承認ユーザーの遮断は「ログイン画面を塞ぐ」では不十分。** セッション発行・`/oauth2/authorize`・UserInfo / トークン更新の**全て**で弾く。RP 経由で認可フローに直接入られてトークンが出たら終わり。
- 承認・却下の権限は `createAccessControl`（`lib/permissions.ts`）で定義し、**サーバ側で必ず検証する**。ボタンを隠すだけの制御は禁止。
- 承認は**冪等**に。二重承認で承認メールが2通飛ばないこと。
- 承認メールの送信失敗で承認処理を巻き戻さない。承認はコミットし、メールは再送可能にする。
- メール送信は**さくらのメールボックス**の SMTP を nodemailer から叩く。設定は `SMTP_*` / `MAIL_FROM` 環境変数。本文にパスワードやトークンを含めない（ログイン URL のみ）。

---

## IdP としての不変条件（破ると脆弱性になる）

実装・レビュー時に必ず確認する:

1. **`redirect_uri` は完全一致で検証する。** 前方一致・部分一致・ワイルドカードを許さない。オープンリダイレクタは OAuth で最も悪用される欠陥。
2. **認可コードは一度しか使えない。** 再利用を検知したら、そのコードから発行済みのトークンごと失効させる。
3. **PKCE は必須（S256 のみ）。** `plain` は受け付けない。
4. **`state` と `nonce` を往復させる。** 同意画面やログイン画面を経由してもクエリを落とさない。
5. **issuer の三点一致** — Discovery が返す `issuer`、ID トークンの `iss`、RP に設定された issuer。ここがズレると RP は繋がらず、しかもエラーが分かりにくい。`next.config.ts` の rewrite はこのために存在する。
6. **`BETTER_AUTH_SECRET` は JWKS 秘密鍵の暗号鍵を兼ねる。** 失うと全トークンが検証不能になる。ローテーション手順を壊さないこと。
7. **エラーメッセージでユーザーの存在を漏らさない。** 「メールアドレスが存在しません」と「パスワードが違います」を区別しない。
8. **パスワードは Argon2id。** Better Auth の既定は scrypt なので、`emailAndPassword.password.hash/verify` の差し替えを外さないこと。`@node-rs/argon2` はネイティブモジュールなので、認証経路を Edge ランタイムにしない。
9. **秘密情報をログに出さない。** 認可コード、アクセストークン、リフレッシュトークン、client_secret、パスワードは伏せる。

---

## 規約

- 依存は**完全固定**（キャレットを付けない）。認証基盤なので、意図しないマイナー更新で挙動が変わるのを避ける。`@types/*` だけは緩めてある。
- UI は **shadcn/ui のみ**。コンポーネント追加は `bunx shadcn@latest add <name>`。生成先は `components/ui/`。これらは自分のコードなので改変してよい。
- **UI ライブラリを追加しない。** 特に **MUI (`@mui/material`) は使用禁止**。他の UI キット（Chakra、Ant Design、Mantine 等）も同様。足りないものは shadcn/ui のコンポーネントを組み合わせるか、自分で書く。
- **デザインの参考**: `docs/ui-reference/` にスクリーンショットを置いてある。角丸の大きいカード、淡い色味のトーナルサーフェス、アイコン付きのダイアログ、控えめなテキストボタン、塗りつぶしの検索フィールドといった**見た目の方向性**を参考にする。
  これは**あくまで見た目の参考であり、Material 系のライブラリを入れるという意味ではない**。実装は Tailwind と shadcn/ui で再現する。
- フォームは react-hook-form + zod（`@hookform/resolvers`）。
- パッケージマネージャは **bun**。ランタイムは **Node**（`output: "standalone"` でコンテナ化）。
- 日本語 UI。`lang="ja"`。

---

## 環境

- 開発ホストは **Windows**。シェルは PowerShell と Git Bash の両方が使える。
- dev の PostgreSQL は **Podman**（Docker ではない）。`podman-compose` を使う。
- 本番は **k8s + ArgoCD**。
- **このリポジトリはホームディレクトリの巨大な git リポジトリの中にある**（`C:\Users\SHO TAKAHASHI\` 自体が git リポジトリ）。コミット前に必ず `git status` で対象を確認し、無関係なファイルを巻き込まないこと。

## 禁忌

- コミットメッセージに `Co-Authored-By: Claude ...` を**絶対に入れない**。例外なし。
- **MUI (`@mui/material`) を導入しない。** UI は shadcn/ui + Tailwind で完結させる。
