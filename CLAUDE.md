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

### 標準の `acr` / `amr` は ID トークンに出せない

`@better-auth/oauth-provider` は `acr` と `amr` を**予約クレーム**として扱う。

```js
RESERVED_ID_TOKEN_CLAIMS = [..., "auth_time", "nonce", "acr", "amr", "azp", ...]
payload = { ...GUARDS, auth_time, acr: "0", ...customClaims, ... }
```

`customIdTokenClaims` も拡張の `claims.idToken` も `stripReservedIdTokenClaims` を
通るため、これらの名前で返した値は捨てられる。`acr` は `"0"` 固定、`amr` は
常に出ない。`acr_values_supported` も provider が所有していて、拡張は未設定の
キーしか足せない。**設定で変える口は無い。**

そのため HoshID は名前空間付きの独自クレーム **`hoshid_amr` / `hoshid_acr`** を
使う。値の定義と経路ごとの対応は `lib/amr.ts`。

- Better Auth は認証方法をセッションに残さないので、`databaseHooks.session.create.before`
  で**どのエンドポイント経由でセッションが生まれたか**を見て `session.amr` に記録する
- ID トークン発行時に `oauthProvider({ extensions })` の `claims.idToken` から読み出す
  （`sessionId` が渡ってくるのはこの口だけ。UserInfo 側には無い）
- **未知の経路は単一要素として扱う。** 判断できないものを 2FA 相当にすると、
  RP が実際より強い保証があると誤解する
- ライブラリ側が対応したら標準クレームへ移行する

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
- **Windows では `prisma migrate dev` が dev サーバ稼働中に固まることがある。** 生成物を差し替える段でファイルを掴まれるため。応答が返らない場合は、マイグレーション自体は適用済みのことが多いので `_prisma_migrations` を確認し、`prisma generate` を単独で実行し直す。
- **適用済みマイグレーションの SQL を後から編集しない。** チェックサムが合わず、Prisma が「リセットして全削除」を要求してくる。直すなら新しいマイグレーションを足す。やむを得ず直した場合は、`_prisma_migrations.checksum` をファイルの sha256 に更新すればデータを消さずに復帰できる。
- **`prisma generate` を実行したら dev サーバの再起動が必要。** `serverExternalPackages` により Prisma Client は実行時に `node_modules` から読まれるため、動いている dev サーバの足元でファイルを差し替えることになる。
  症状は2つの形で出る。どちらもコードは正しいので、直そうとして時間を溶かしやすい。
  - **既存モデルを触った場合**: `/api/auth/*` が軒並み 500（`/jwks` や discovery まで）になる一方、ページは 200 のまま。プロセス内から `auth.api.*` を直接呼ぶと成功するのに HTTP だと落ちる。
  - **モデルを追加した場合**: `Cannot read properties of undefined (reading 'findMany')` のように、`prisma.<新モデル>` が `undefined` になる。追加したモデルを最初に使う画面だけが落ちる。

  **疑う前にディスク側を確かめる。** `node_modules/.prisma/client/index.d.ts` に新モデル名があり、`bunx prisma migrate status` が "up to date" なら、残っているのは実行中プロセスのメモリだけ = 再起動で直る。
  スキーマを変えた（= `auth:schema` や `prisma migrate` を走らせた）後は、必ず再起動を促すこと。アカウントや認証設定の問題と誤診しやすい。
- **Next 16 + Turbopack で `Cannot find module '.prisma/client/default'` が出る。** `next.config.ts` の `serverExternalPackages` と `turbopack.resolveAlias` で対処済み。**この2つを消さないこと。**
  - 併せて `schema.prisma` の generator は `provider = "prisma-client-js"` のままにし、`output` を足さない。`prisma-client` プロバイダに変えると再発する。
  - ネット上の記事は `experimental.turbo` に書いているが、**Next 16 ではトップレベル `turbopack`**。

### サーバ専用モジュールをクライアントに引きずり込まない

**このプロジェクトで最も繰り返し踏んでいる失敗。** クライアントコンポーネント
（`"use client"`）が、サーバ専用の依存を持つモジュールから定数や型を import すると、
その依存ごとブラウザ向けバンドルに巻き込まれてビルドが落ちる。

```
Module not found: Can't resolve 'fs'
  ./node_modules/pg/lib/index.js [Client Component Browser]
  ./lib/prisma.ts [Client Component Browser]
  ./lib/webhook.ts [Client Component Browser]
  ./app/.../webhook-manager.tsx [Client Component Browser]
```

エラーは import の連鎖を出してくれるので、**末端の client component から
たどって、どのモジュールがサーバ専用依存を持ち込んでいるかを見る**。

対処は、定数・型・純粋関数だけを持つモジュールに切り出し、クライアントは
そちらを参照する。実績のある分割:

| クライアント用（依存なし） | サーバ用（Prisma / sharp を持つ） |
|---|---|
| `lib/webhook-kinds.ts` | `lib/webhook.ts` |
| `lib/avatar-constants.ts` | `lib/avatar.ts` |

切り出したモジュールには「ここにサーバ専用の処理を書かないこと」とコメントを
残してある。消さないこと。

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
bun run deploy:prepare     # ★本番の起動前に一度。db:deploy + 鍵の保守処理
bun run db:generate        # Prisma Client を再生成
bun run db:studio          # Prisma Studio

bun run typecheck          # next typegen && tsc --noEmit
bun run lint               # eslint .
bun run build              # next build（Turbopack）
```

検証用スクリプト（dev サーバと DB が動いている前提）:

```bash
# 申請フローの安全性（DB だけあれば動く）
bun run scripts/verify-application-flow.ts

# 鍵の運用（DB だけあれば動く）
bun run jwks              # 署名鍵の状態表示。何も変えない
bun run jwks --rotate     # 予定を待たずに次の鍵へ
bun run jwks --revoke <kid>   # 漏洩時。即座に JWKS から削除する
bun run keys:maintain     # デプロイ時の保守（期限の設定・再暗号化・古い行の削除）。べき等
bun run secrets:reencrypt --dry   # ルート秘密の版を入れ替えるとき、何が書き換わるか
bun run verify:jwks       # 作った鍵をサーバと同じ経路で復号・署名・検証できるか
bun run verify:secrets    # DB の暗号文を全部いまの秘密で読めるか（★復元直後に必ず）

# 認可コードフローを頭から終わりまで通す
HOSHID_CLIENT_ID=... HOSHID_CLIENT_SECRET=... E2E_EMAIL=... E2E_PASSWORD=... bun run scripts/e2e-authorization-code.ts

# ブラウザで確認する用の RP（http://127.0.0.1:4000/login）
HOSHID_CLIENT_ID=... HOSHID_CLIENT_SECRET=... bun run scripts/test-rp/index.ts
```

**`bun run dev` を勝手に起動しない。** ユーザーが自分で dev サーバを回している場合があり、`.next` を共有すると衝突する。動作確認で起動が必要になったら、まず一声かけること。

---

## 構成

**`src/` ディレクトリは使わない。** `app/` をプロジェクト直下に置く。インポートエイリアス `@/*` はリポジトリルートを指す（`@/lib/auth` = `lib/auth.ts`）。

```
app/
  api/auth/[...all]/route.ts   Better Auth ハンドラ（GET/POST）
  api/avatar/[userId]/         アイコン配信（認証不要。picture クレームに使う）
  api/link/[provider]/         Discord / GitHub との連携（start と callback）
  (auth)/                      認証画面のルートグループ（共通 Card レイアウト）
    sign-in/                   ログイン（パスワード / パスキー）
    apply/  apply/link/  apply/submitted/
                               アカウント申請 → 外部アカウント連携 → メール確認
                               （sign-up は存在しない）
    forgot-password/  reset-password/   パスワードの再設定
    two-factor/                二段階認証の確認（認証アプリ / メール / バックアップ）
    pending/                   ログインできないアカウント向けの案内
    consent/                   同意画面（サーバで client を引いて警告を出す）
  lounge/                      アカウントポータル（要ログイン・要 active）
    page.tsx                   ダッシュボード
    account/                   プロフィール / アイコン / セキュリティ / 連携アプリ
    announcements/             お知らせ（閲覧）
    members/  members/[userId]/  メンバー名簿と個別プロフィール
    apps/                      OAuth クライアントの登録・削除
    settings/                  表示・通知・キャッシュ削除・アプリ情報
    admin/                     申請の審査
    admin/members/             メンバー管理（編集・削除）
    admin/announcements/       お知らせの作成・編集・削除（admin のみ）
    admin/webhooks/            Discord / Slack 通知先
    admin/audit/               監査ログの閲覧
    admin/keys/                署名鍵とルート秘密の状態（閲覧のみ。操作は CLI）
    admin/guide/  admin/glossary/   管理者の手引きと用語集（役員も読める）
  help/                        使い方 / 用語集 / FAQ / お問い合わせ（ログイン不要）
  legal/                       利用規約 / プライバシーポリシー / ライセンス
  layout.tsx  page.tsx  globals.css
instrumentation.ts             起動時に一度走る。いまは鍵の点検のみ（書き換えはしない）
components/
  ui/                          shadcn/ui（生成物だが自分のコード。手を入れてよい）
  status-help.tsx              ステータスの説明ポップオーバー
  markdown.tsx                 お知らせ本文の Markdown 描画（生 HTML は通さない）
  glossary.tsx                 用語集の見た目（一般向けと管理者向けで共有）
  sliding-tabs.tsx / sliding-link-tabs.tsx   下線が滑るタブ（状態版 / リンク版）
  site-footer.tsx              法的文書・不具合報告への導線
  appearance-script.tsx        配色と動きの設定を描画前に反映する
prisma/
  schema.prisma                ★ Better Auth 由来のモデルは手書きしない。auth:schema で生成
  migrations/                  prisma migrate の生成物
lib/
  prisma.ts                    PrismaClient（@prisma/adapter-pg 必須）
  auth.ts                      Better Auth 本体（全プラグイン構成）
  auth-client.ts               createAuthClient（React 用）
  session.ts                   requireApprovedUser など、画面側のガード
  authorize.ts                 requirePermission（サーバ側の権限検証）
  permissions.ts               createAccessControl によるロール定義（admin / officer）
  account-status.ts            ステータスと canSignIn()
  jwks.ts                      署名鍵の寿命と、秘密の版の解決（auth.ts と鍵スクリプトが共有）
  key-health.ts                鍵の健康診断（管理画面・起動時の警告・保守処理が共有）
  key-maintenance.ts           鍵への操作の本体。表示はせず結果を返すだけ
  audit.ts                     管理操作の記録（recordAudit。失敗しても元の操作は巻き戻さない）
  announcement.ts              お知らせの種別と入力上限
  amr.ts                       認証方法のクレーム（標準 acr/amr が使えない事情も）
  avatar.ts / avatar-constants.ts   アイコン処理（sharp）と、クライアント安全な定数
  webhook.ts / webhook-kinds.ts     通知送信と、クライアント安全な定数
  mail.ts / mail-template.ts   メール送信と HTML 組み立て
  links.ts                     プロフィールのリンク（URL 検証を含む）
  social.ts / social-providers.ts   外部アカウント連携と、クライアント安全な定数
  application-ticket.ts        申請中の本人を指す短命のチケット（セッションの代わり）
  scopes.ts                    スコープ → 日本語説明のマップ
  oauth-flow.ts                認可フロー復帰（署名付きクエリの扱い）
  user-agent.ts                端末名の整形
  utils.ts                     cn()
scripts/
  seed-admin.ts                初代管理者を active で作成（これが無いと全員 prepared で詰む）
  seed-client.ts               検証用 OAuth クライアント登録
  test-rp/                     openid-client による検証用 RP（ポート 4000）
  e2e-authorization-code.ts    認可コードフローの自動検証
  verify-application-flow.ts   申請フローの安全性の自動検証
  send-test-mail.ts            SMTP の疎通確認
  rotate-jwks.ts               署名鍵の状態表示・交換・失効（人が判断して叩く）
  key-maintenance.ts           デプロイ時に自動で走る保守処理（べき等）
  reencrypt-secrets.ts         暗号文を現行版の秘密へ書き換える
  verify-jwks-roundtrip.ts     作った鍵が本当に使えるかの自動検証
  verify-secrets-readable.ts   DB の暗号文を全部読めるかの確認（復元の検証用）
  generate-licenses.ts         依存のライセンス一覧を data/ に書き出す
docs/key-rotation.md           鍵の運用手順（署名鍵とルート秘密は別物。読まずに触らない）
docs/backup.md                 バックアップと復元（ダンプと秘密は組。片方だけでは戻せない）
Dockerfile                     runner（アプリ）と migrator（マイグレーションと鍵の保守）の2ターゲット
compose.yaml                   イメージのビルドと、本番に近い構成での起動
.github/workflows/             ci.yml（型・lint・ビルド・実DB検証）/ image.yml（イメージの公開）
k8s/                           Deployment / Service / Ingress / migration Job（未着手）
compose.dev.yaml               dev 用 PostgreSQL（Podman / network_mode: host）
```

`prisma/schema.prisma` のうち Better Auth 由来のモデルは `auth:schema` の生成物。テーブルを増やしたくなったら `lib/auth.ts` のプラグイン構成を変えて再生成する。手で書いたモデルは残るが、生成対象のモデルを直接編集すると次の生成で上書きされる。

---

## アカウント申請フロー

**HoshID は誰でも自由にアカウントを作れる IdP ではない。** サインアップは「申請」であり、最高権限保持者（`admin` / `officer`＝役員）の承認を経て初めて利用可能になる。

```
申請 → prepared ──承認──→ active     ログイン可能。承認メールと Webhook を送信
                 └─却下──→ rejected   ログイン不可
                            archived   使われなくなったので停止
                            suspended  規約違反などで停止
```

- **ログインできるのは `active` だけ。** 判定は `canSignIn()`（`lib/account-status.ts`）に集約してある。ここを迂回して `status === "..."` を直接書かないこと。
- `/sign-up` は存在せず `/apply` が申請フォーム。
- **メールアドレスの確認もログインの条件**（`requireEmailVerification: true`）。ステータスによる遮断とは**別の関門**で、片方だけでは足りない。これが無いと他人のアドレスで申請でき、承認されたそのアカウントは `email` クレームにそのアドレスを載せて RP へ渡る。**RP の多くはメールアドレスでアカウントを紐づける**ので、なりすましの経路になる。申請直後（`sendOnSignUp`）と、未確認のままログインを試みたとき（`sendOnSignIn`）に確認メールを送る。後者が無いと、最初のリンクが切れた人に詰みを解く手段が無い。
- **承認の判断材料としてメール未確認を一覧に出す**（`/lounge/admin`）。確認できていないアドレスは本人のものである保証が無い。
- **パスワード再設定は、要求の成否を画面で出し分けない。** 出し分けると、あるアドレスが登録済みかどうかを誰でも確かめられる。再設定したら他のセッションを全て失効させる（`revokeSessionsOnPasswordReset`）。再設定する理由の多くは「漏れたかもしれない」なので、既存のセッションを生かしては意味が薄い。
- **`status` をクライアント入力から設定させない。** `user.additionalFields` の `input: false` と `databaseHooks.user.create.before` による上書きの**二重防御**。片方でも外すと、申請 API に `status: "approved"` を混ぜるだけで承認を自称できる。
- **未承認ユーザーの遮断は「ログイン画面を塞ぐ」では不十分。** セッション発行・`/oauth2/authorize`・UserInfo / トークン更新の**全て**で弾く。RP 経由で認可フローに直接入られてトークンが出たら終わり。
- 承認・却下の権限は `createAccessControl`（`lib/permissions.ts`）で定義し、**サーバ側で必ず検証する**。ボタンを隠すだけの制御は禁止。
- 承認は**冪等**に。二重承認で承認メールが2通飛ばないこと。
- 承認メールの送信失敗で承認処理を巻き戻さない。承認はコミットし、メールは再送可能にする。ただし黙って握り潰さず、画面に「承認したがメールを送れなかった」と出す。
- Webhook も同様に、送信失敗で申請や承認を巻き戻さない。5秒でタイムアウトさせ、申請処理を待たせない。
- **Webhook の登録先は Discord / Slack の正規ホストの https に限定する。** 任意の URL を登録できると、HoshID のサーバから内部ネットワークへリクエストを送らせる SSRF の踏み台になる。
- メール送信は**さくらのメールボックス**の SMTP を nodemailer から叩く。設定は `SMTP_*` / `MAIL_FROM` 環境変数。本文にパスワードやトークンを含めない（ログイン URL のみ）。

---

## 外部アカウントとの連携（Discord / GitHub）

申請者の本人確認（Discord）と、プロフィール表示（GitHub の草）に使う。実装は
`lib/social.ts`（サーバ）と `lib/social-providers.ts`（クライアント安全な定数）。

- **Better Auth の `linkSocial()` は使わない。** あれはセッションを要求するが、
  申請者は `prepared` なのでセッションを作れない。ここを解くために `canSignIn`
  を緩めてはいけない。代わりに OAuth を自前で往復し、連携先の利用者を
  「セッション」か「申請チケット」のどちらからでも決められるようにしている。
- **申請チケット（`lib/application-ticket.ts`）でできるのは、連携を付けることと
  確認メールを送り直すことだけ。** ログインの代わりにしない。読み出しにも使わない。
- **チケットは Cookie からしか読まない。** クエリで受け取ると、他人に踏ませた
  URL で連携先をすり替えられる。同じ理由で、サーバアクションが userId を
  引数で受け取る作りにしない。
- **連携先の利用者は state の中の userId で決める。** クエリからは取らない。
  state は暗号化してあり、nonce を Cookie と突き合わせる。
- **同じ外部アカウントを複数の HoshID アカウントに繋がせない**
  （`@@unique([provider, providerAccountId])`）。できると1つの Discord で
  何人分もの申請を裏付けられ、本人確認の意味が消える。
- **Discord は1人が複数繋げる。GitHub は1人1つ。** 後者は provider の値による
  条件付きなので Prisma では表せず、マイグレーションの部分ユニークインデックスで
  縛っている。`allowsMultiple`（`lib/social-providers.ts`）と対にして扱うこと。
- **アクセストークンは保存しない。** 欲しいのは本人であることと表示用の名前と
  アイコンだけで、一度取れば足りる。持ち続ければ漏れたときの被害になる。
- **要求するスコープを増やさない。** Discord は `identify` のみ、GitHub は
  `read:user` のみ。どちらもメールアドレスを取らない。
- **草は外部サービスの画像を貼らずに、取得したデータから自前で描く**
  （`components/contribution-graph.tsx`）。画像を埋めると、メンバーページを
  開いた人の IP が第三者に渡り、相手が落ちれば表示も壊れる。
- 草の取得には `GITHUB_CONTRIBUTIONS_TOKEN` が要る（利用者のトークンは保存して
  いないため）。**この名前を `GITHUB_TOKEN` に戻さないこと。** あの名前は広く
  使われていて、シェルや OS の環境変数に残っていると `.env` より優先される
  （**dotenv も Next.js も、既に `process.env` にある値を上書きしない**）。
  GitHub Actions は実行時に自動で注入してくる。どちらも意図しないトークンで
  401 になり、原因が環境変数の衝突だとは気づけない。
  **GitHub の GraphQL はスコープの無いトークンも 401 で拒否する。** 無効や
  スコープ不足は「草が出ないだけ」で気づけないので、警告をログに出している。
- **Discord のロール付与は Bot の仕事で、OAuth のスコープではない。**
  `PUT /guilds/{guild}/members/{user}/roles/{role}` を Bot トークンで叩く。
  利用者から追加の許可は要らない（`identify` で得た ID だけで足りる）。
  Bot は対象サーバにいて `MANAGE_ROLES` を持ち、**付けたいロールより上の位置**に
  いる必要がある（満たさないと 403）。実装は `lib/discord-role.ts`。
- **ロールを持つのは `active` だけ。** ログインできる状態と一致させる。承認・却下・
  ステータス変更・削除・連携の追加と解除のすべてから `syncDiscordRole` を呼ぶ。
  **ロールの操作で HoshID 側の処理を巻き戻さない。**
- **「サーバにいるか」を OAuth のスコープで解かない。** `guilds` はその人の全サーバ
  一覧を寄越すもので、yes/no が欲しいだけなのに他人のサーバ所属まで預かることに
  なる。Bot に1つのサーバだけ問い合わせれば、追加の許可も余計なデータも要らない。
  結果は `socialLink.inGuild` に写す（一覧から毎回 Discord を叩かないため）。
- **`x-audit-log-reason` は必ず `encodeURIComponent` を通す。** HTTP ヘッダは
  Latin-1 しか運べないので、日本語をそのまま入れると `fetch` が例外を投げ、
  **ロールの操作そのものが失敗する。** しかも失敗は警告ログに出るだけなので、
  「承認したのにロールが付かない」という形でしか気づけない（実際に踏んだ）。
- **突き合わせ（`reconcileDiscordRoles`）は既定で dry-run。** あれは「HoshID と
  繋がっていない人からロールを外す」動きを含む。そのロールが HoshID 以前から
  別の意味で使われていた場合、初回の実行で既存メンバー全員から剥がすことに
  なる。`--apply` を明示させること。
- **成功数を報告する。投げた数ではない。** 全部失敗していても「17件解除しました」
  と出る作りになっていて、実際にそれで嘘をついた。
- **「失敗」と「サーバにいない」を区別する。** 一緒にすると、ロールが付かない理由が
  Bot の設定不備なのか本人の未参加なのか分からず、直す相手を間違える。失敗のときは
  `inGuild` を上書きしない（直った後も「未参加」と出続けるため）。
- **連携は申請の必須条件にしていない。** 審査画面に ◯ / ✕ で出して、承認するか
  どうかを管理者が判断する。必須にすると Discord を持っていない人が申請自体を
  できなくなる。

---

## IdP としての不変条件（破ると脆弱性になる）

実装・レビュー時に必ず確認する:

1. **`redirect_uri` は完全一致で検証する。** 前方一致・部分一致・ワイルドカードを許さない。オープンリダイレクタは OAuth で最も悪用される欠陥。
2. **認可コードは一度しか使えない。** 再利用を検知したら、そのコードから発行済みのトークンごと失効させる。
3. **PKCE は必須（S256 のみ）。** `plain` は受け付けない。
4. **`state` と `nonce` を往復させる。** 同意画面やログイン画面を経由してもクエリを落とさない。
5. **issuer の三点一致** — Discovery が返す `issuer`、ID トークンの `iss`、RP に設定された issuer。ここがズレると RP は繋がらず、しかもエラーが分かりにくい。
   **この IdP の issuer は origin ではなく `<origin>/api/auth`。** Better Auth のマウント先がそのまま issuer になり、Discovery もその下（`/api/auth/.well-known/openid-configuration`）に出る。OIDC Discovery は issuer に `/.well-known/openid-configuration` を連結した場所を見るので、これで仕様どおり整合している。
   **ルート直下に .well-known を rewrite で生やさないこと。** そこで discovery した RP は issuer を `<origin>` と解釈する一方、文書は `<origin>/api/auth` を名乗るため不一致で弾かれる。
6. **`BETTER_AUTH_SECRET` は DB 内の秘密すべての暗号鍵を兼ねる。** JWKS の秘密鍵だけでなく、**二要素認証の TOTP シークレットとバックアップコード**、メール OTP、OAuth の `state` も同じ鍵で暗号化されている。単純に差し替えると 2FA 利用者が全員締め出される。入れ替えは `BETTER_AUTH_SECRETS` に版を足す形で行う。手順は `docs/key-rotation.md`。
7. **エラーメッセージでユーザーの存在を漏らさない。** 「メールアドレスが存在しません」と「パスワードが違います」を区別しない。
   ただし**原因を確定できないエラーを「承認待ち」と断定しない**こと。未承認アカウントはセッション生成が拒否されて失敗するが、サーバ障害でも同じ経路を通る。断定すると、ただの障害を仕様だとユーザーに誤認させる。
8. **パスワードは Argon2id。** Better Auth の既定は scrypt なので、`emailAndPassword.password.hash/verify` の差し替えを外さないこと。`@node-rs/argon2` はネイティブモジュールなので、認証経路を Edge ランタイムにしない。
9. **`refresh_token` は `offline_access` を要求した時だけ発行される。** RP 側のスコープに入れ忘れると、リフレッシュできない理由が分からず悩むことになる。
10. **セッショントークンを画面に渡さない。** `listSessions` は `token` を返すが、これは Cookie に入っている資格情報そのもの。画面には**セッション ID だけ**を渡し、失効はサーバ側で ID → トークンを解決する。その際 `userId` で必ず絞る。
11. **OAuth クライアントには必ず `scope` を設定する。** 空のまま登録すると認可時に `invalid_scope` で落ちる。
12. **プロキシの後ろに置くなら `TRUSTED_PROXIES` を設定する。** 設定しないとクライアント IP を特定できず、**レート制限が全員で1つのバケツ**になる（ログインは10秒3回）。監査ログの IP も `x-forwarded-for` の左端＝クライアントが詐称できる値になる。設定は `lib/request-ip.ts`、IP の解決は Better Auth の `getIP` を audit.ts と共有している。**`x-forwarded-for` を自前で読む実装を足さないこと。**
13. **秘密情報をログに出さない。** 認可コード、アクセストークン、リフレッシュトークン、client_secret、パスワードは伏せる。

---

## 鍵の運用

手順は `docs/key-rotation.md`。コードを触るときに壊してはいけないのは次の点。

- **署名鍵とルート秘密は別物。** 署名鍵（`jwks` テーブル）は90日で自動ローテーションする。ルート秘密（`BETTER_AUTH_SECRET`）は**定期的に替えない**。事故のときだけ。
- **猶予期間（`JWKS_GRACE_PERIOD_SECONDS`）を縮めない。** 発行済みトークンの最大寿命（ID トークンの10時間）を下回ると、まだ有効期限内のトークンが「署名した鍵が JWKS に無い」で弾かれる。RP からは原因が見えない壊れ方をする。`idTokenExpiresIn` を延ばすならこちらも見直す。
- **`rotationInterval` は新しく作る鍵にしか効かない。** 期限が空の鍵は永遠に署名し続ける。しかもエラーは出ない。`keys:maintain`（デプロイ時に自動）が拾うので、この処理を外さないこと。
- **鍵を手で作らない。** `lib/key-maintenance.ts` の `mintKey()` を使う。Better Auth の `createJwk` と同じ形（暗号化の方式、`JSON.stringify` の有無）で作らないと、サーバが復号できない鍵ができる。
- **版を足しただけではローテーションになっていない。** Better Auth が版を使うのは新しく書くときだけで、既存の暗号文は古い版のまま残る。とくに TOTP シークレットは利用者が 2FA を設定し直すまで書き換わらない。`reencryptSecrets()` を通すまで古い版を外さないこと。
- **復号できない行を上書きしない。** 上書きすると復旧できなくなる。飛ばして警告に出す。
- **デプロイ時の保守処理は `adopt` / `reencrypt` / `prune` の3つだけ。** どれもべき等で利用者に影響が出ない。`rotate` と `revoke` を自動化しないこと。
- 鍵まわりを変えたら `bun run verify:jwks` を通す。**ここが落ちる状態で本番に出すと、症状はログインの失敗として現れる。**

---

## 監査ログ

`lib/audit.ts` の `recordAudit()` に集約する。閲覧は `/lounge/admin/audit`（`user: ["set-role"]` が必要。役員には見せない）。

- **記録するのは「誰かの権限で、他人や全体に影響する操作」だけ。** 本人が自分のプロフィールを変えた程度まで入れると、量に埋もれて肝心な記録が見つからなくなる。
- **記録の失敗で元の操作を巻き戻さない。** 承認できたのにログを書けず承認が取り消される方が困る。ただし握り潰さず、サーバのログに警告を残す。
- **行為者と対象は、その時点の名前を写して持つ**（`actorLabel` / `targetLabel`）。参照で持つと、アカウントやお知らせが消えた後に「誰が何をしたか」を辿れなくなる。
- **削除を記録するときは、消す前に名前を読む。** 消した後では何を消したのか分からない。
- **秘密情報を `detail` に入れない。** 特に **Webhook の URL は載せない**。Discord も Slack も URL そのものが投稿の鍵なので、監査ログに書くと閲覧できる人全員に通知先を乗っ取る手段を渡すことになる。トークン・パスワード・認可コードも同様。

---

## 画面を作るときの約束

- **利用者が入力した URL は `http` / `https` だけ通す**（`lib/links.ts` の `normalizeUrl`）。`javascript:` を許すと、プロフィールを開いた人のブラウザで任意のスクリプトが走る。
- 他人が入力した URL へのリンクには `rel="noopener noreferrer nofollow ugc"` を付ける。
- **アップロード画像はサーバで必ず再エンコードする**（`lib/avatar.ts`）。クライアントの切り抜き結果は信用しない。EXIF も落とす（位置情報の意図しない公開を防ぐ）。
- **メールに差し込む利用者入力は必ずエスケープする**（`lib/mail-template.ts` の `escapeHtml`）。
- 原因を確定できないエラーを断定的に説明しない。未承認とサーバ障害が同じ経路を通る場面がある。
- 破壊的な操作は段階を踏ませる。アカウント削除は一般2段・管理者3段、最終段はメールアドレスの入力で確認する。
- **現在地は下線、ホバーは塗り。** 役割を分けると、ホバー中に現在地を見失わない。
  根拠は[デジタル庁デザインシステムの水平メニュー](https://design.digital.go.jp/dads/components/horizontal-menu/)で、
  カレントを「色付きの文字＋下線」、ホバーを「背景の塗り」で表している。
  **逆にしない**（塗りで現在地を示すと、ホバーと区別が付かなくなる）。
- **左端のアクセント罫線は使わない。** 項目の当たり判定と見た目の範囲がずれ、
  横並びになる狭い画面では意味も失う。
  - 例外は引用ブロック（`components/markdown.tsx`）。あれは選択状態ではなく、引用という標準の表現。

---

## ビルドとデプロイ

- **イメージのターゲットは2つ。** `runner`（Next.js standalone を node で動かす）と
  `migrator`（bun + Prisma CLI + scripts）。アプリのコンテナにシードスクリプトや
  Prisma CLI を載せないために分けてある。どちらも同じ `build` ステージから作る。
- **standalone は `node_modules/.prisma` と `@prisma` を取りこぼす。** Dockerfile で
  明示的にコピーしている。**消さないこと。** 欠けると `/api/auth/*` だけが 500 に
  なり、ページは 200 のままという分かりにくい形で出る（dev の「Prisma Client が
  古い」症状と見分けがつかない）。
- **ベースは Debian (slim)。** alpine にすると `@node-rs/argon2` と `sharp` が musl 用の
  ビルドを要求する。認証基盤なので、イメージの小ささよりネイティブモジュールが
  確実に動くことを取る。
- **`next build` は `lib/auth.ts` を評価する。** `requireEnv` が落ちないよう、
  ビルド時は明らかに偽の値を渡している。ページは全て動的なので出力には焼き込まれない。
- **CI のビルド定義は compose.yaml にひとつだけ置く。** ワークフロー側に
  Dockerfile の引数を書き写すと、必ず片方が古くなる。
- **ArgoCD には `sha-<短いSHA>` タグを指す。** ブランチ名や `latest` を指すと、同じ
  タグの中身が入れ替わって「いつのイメージが動いているか」が追えなくなる。
- **この開発機では buildkit のコンテナを作れない**（WSL カーネルに nf_tables が無く
  netavark が失敗する。compose.dev.yaml と同じ理由）。手元で確かめるときは
  `podman build --network=host` を使う。CI の ubuntu ランナーでは起きない。

---

## 説明ページを書くときの約束

`/help/guide`（一般向け使い方）、`/help/glossary`（一般向け用語集）、
`/lounge/admin/guide`（管理者の手引き）、`/lounge/admin/glossary`（管理者向け用語集）。

- **実装されている機能だけを書く。** 無いものを書くと、利用者は見つからないものを
  探し続ける。機能を消したら説明ページからも消すこと。
- **ステータスとスコープの説明は `lib/` から引く**（`ACCOUNT_STATUS_DESCRIPTIONS`、
  `SCOPE_DESCRIPTIONS`）。書き写すと、画面の表示と説明が食い違う。鍵の日数も
  `lib/jwks.ts` の定数から計算する。
- **一般向けは「画面に出てくる言葉」、管理者向けは「仕組みの側の言葉」。** 一般向けに
  `kid` や `issuer` を持ち込まない。逆に管理者向けでパスキーの説明を繰り返さない。
- **実装の詳細を書かない。** それは CLAUDE.md と `docs/` の仕事で、両方に書くと両方が
  古くなる。説明ページに書くのは「なぜその操作を慎重にやるのか」という、画面を見ても
  分からないこと。
- 管理者の手引きは**役員も読む**（`application: ["list"]` で入れる）。管理者だけができる
  操作は、見出しにその旨を書いて区別する。

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
