# HoshID

セルフホストの **OpenID Connect Provider**。

自分のサービス群を RP（Relying Party）としてぶら下げるための一次認証基盤。外部 IdP へのフェデレーションは行わず、HoshID 自身がアイデンティティの源になる。

アカウントは**自由に作成できない**。申請 → 管理者の承認を経て初めて利用できる。

## 構成

| 領域 | 採用 |
|---|---|
| フレームワーク | Next.js 16（App Router / Turbopack） |
| 認証基盤 | Better Auth + `@better-auth/oauth-provider`（OAuth 2.1 Provider） |
| 署名鍵 / JWKS | Better Auth `jwt()` プラグイン（EdDSA / Ed25519） |
| 認証手段 | パスワード（Argon2id）/ Passkey（WebAuthn）/ 二段階認証（認証アプリ・メール） |
| UI | shadcn/ui + Tailwind CSS v4 |
| DB | PostgreSQL + Prisma 7 |
| メール | さくらのメールボックス（SMTP / nodemailer） |
| dev | Podman |
| prod | k8s + ArgoCD |

## セットアップ

```bash
bun install

cp .env.example .env               # 下記の環境変数を埋める
openssl rand -base64 32            # BETTER_AUTH_SECRET 用

bun run db:up                      # PostgreSQL を起動（Podman）
bun run db:migrate                 # スキーマ適用

# 初代管理者を作る。これが無いと承認できる人が誰もおらず全員 Prepared のまま詰む
SEED_ADMIN_EMAIL=you@example.jp SEED_ADMIN_PASSWORD=... bun run seed:admin

bun run dev
```

`.env` に入れる値は [.env.example](.env.example) を参照。`DATABASE_URL` / `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` が必須で、メール通知を使うなら `SMTP_*` と `MAIL_FROM` も要る。

> **`prisma generate` を実行したら dev サーバを再起動すること。** Prisma Client は実行時に `node_modules` から読まれるため、動いているサーバの足元でファイルが入れ替わる。症状は「`/api/auth/*` が軒並み 500 になるのにページは 200」。詳細は [CLAUDE.md](CLAUDE.md)。

## コマンド

```bash
bun run dev / build / start

bun run typecheck                  # next typegen && tsc --noEmit
bun run lint

bun run db:up / db:down            # PostgreSQL（Podman）
bun run db:migrate                 # マイグレーション作成＋適用
bun run db:deploy                  # 適用のみ（本番 / CI）
bun run auth:schema                # auth.ts の構成から schema.prisma を再生成
bun run db:generate / db:studio

bun run seed:admin                 # 初代管理者
bun run seed:client                # 検証用 OAuth クライアント
bun run rp                         # 検証用 RP（http://localhost:4000/login）
bun run e2e                        # 認可コードフローの自動検証
bun run verify:apply               # 申請フローの安全性の自動検証
bun run mail:test                  # SMTP 設定の疎通確認
```

## RP から繋ぐ

**issuer は origin ではなく `<origin>/api/auth`。** Better Auth のマウント先がそのまま issuer になる。Discovery は `<origin>/api/auth/.well-known/openid-configuration`。

クライアントの登録は `/lounge/apps` から。登録時の制約:

- **リダイレクト URI は完全一致**で照合される。末尾のスラッシュまで正確に
- 公開ホストは **https のみ**。http は `localhost` と `127.0.0.1` のみ（この場合 `application_type` は自動で `native` になる）
- **スコープを必ず指定する。** 空のままだと認可時に `invalid_scope` で落ちる
- `refresh_token` が要るなら `offline_access` をスコープに含める
- PKCE は既定で必須（S256）。PKCE 非対応の古いアプリのみ、コンフィデンシャルクライアントに限って外せる

登録画面では、使う機能だけを個別に有効にする。増やすほど鍵が漏れたときにできることが増えるため、既定はすべて無効。

| 機能 | 用途 |
|---|---|
| サーバ間通信 | Client Credentials。利用者の同意を挟まずトークンを取る。パブリッククライアントでは使えない |
| 機器からのログイン | Device Code。利用者は別の端末で `/device` にコードを入力する |
| アプリからのログアウト | RP-Initiated Logout。アプリ側の操作で HoshID のセッションも終了できる |

### 認証方法のクレーム

**標準の `acr` / `amr` は出せない。** `@better-auth/oauth-provider` が両方を予約クレームとして扱い、拡張から返した値を捨てたうえで `acr: "0"` を固定で入れるため。代わりに名前空間付きの独自クレームを ID トークンに載せている。

| 認証経路 | `hoshid_amr` | `hoshid_acr` |
|---|---|---|
| パスワードのみ | `pwd` | `hoshid:1fa` |
| パスキー | `hwk` `user` `mfa` | `hoshid:2fa` |
| パスワード + 認証アプリ | `pwd` `otp` `mfa` | `hoshid:2fa` |
| パスワード + メールコード | `pwd` `otp` `mfa` | `hoshid:2fa` |
| パスワード + バックアップコード | `pwd` `mfa` | `hoshid:2fa` |

値は RFC 8176 に準拠。二要素を要求する RP は `hoshid_acr === "hoshid:2fa"` を確認する。

## アカウントのステータス

ログインできるのは **`active` だけ**。

| | 意味 |
|---|---|
| `prepared` | 申請済み・未審査 |
| `active` | 承認済み。利用できる |
| `rejected` | 申請が承認されなかった |
| `archived` | 使われなくなったため停止 |
| `suspended` | 規約違反などにより停止 |

未承認ユーザーはログイン画面だけでなく、**セッション生成の時点で弾かれる**。RP 経由で認可エンドポイントに直接入ってもトークンは発行されない。

## アカウントポータル `/lounge`

| 画面 | 内容 |
|---|---|
| ダッシュボード | 連携アプリ数・ログイン端末数の概要 / 新しいお知らせ |
| アカウントセンター | プロフィール・アイコン・リンク / パスワード・パスキー・二段階認証・端末管理 / 連携アプリの解除 |
| お知らせ | 運営からのお知らせ（Markdown。重要なものはメールでも届く） |
| メンバー | 利用中メンバーの名簿と個別プロフィール |
| アプリ | OAuth クライアントの登録・削除 |
| 設定 | 配色と動き / お知らせメールの受信 / キャッシュの削除 / ヘルプ・法的文書 / アプリ情報 |
| 管理 *（admin / 役員）* | 申請の審査 / メンバー管理 / 手引き・用語集 |
| 管理 *（admin のみ）* | お知らせの作成 / Webhook 通知先 / 監査ログ |

利用者向けの説明は `/help` に置いてある（ログイン不要）。使い方・用語集・よくある質問・お問い合わせ。管理者向けの運用の手引きと用語集は `/lounge/admin/guide` にある。

## 実装状況

- [x] **M1** — アカウント申請 / 未承認ユーザーの遮断 / パスワードログイン / Authorization Code + PKCE / Discovery / JWKS / ID トークン / UserInfo / 同意画面 / Refresh Token
- [x] **M2** — 申請の承認・却下画面 / ロール（admin・役員）/ 承認メール送信 / Discord・Slack への Webhook 通知
- [x] **M3** — Passkey（WebAuthn）/ 二段階認証（認証アプリ・メール・バックアップコード）/ 認証方法のクレーム / アカウントセンター
- [x] **M4** — Client Credentials / Device Code (RFC 8628) / Introspection・Revocation の公開 / RP-Initiated Logout（動的クライアント登録は方針として無効のまま）
- [ ] **M5** — 監査ログ（済）/ 鍵ローテーション運用（済）/ CI とコンテナイメージ（済）/ バックアップ方針（済）/ パスワード再設定とメール確認（済）/ k8s 本番化

パスワードの再設定と、申請時のメールアドレス確認を入れてある。**メールアドレスの確認はログインの条件**で、他人のアドレスで申請したアカウントが `email` クレームを名乗るのを防ぐ。ステータスによる遮断とは別の関門。

動的クライアント登録（RFC 7591）は**意図的に無効**にしている。画面から登録できるため必要性が薄く、有効にすると認証なしでクライアントを作られ、同意画面で偽のアプリ名を名乗る足がかりになる。

## ビルドとデプロイ

```bash
docker compose build     # runner（アプリ）と migrator（マイグレーションと鍵の保守）
docker compose up -d     # Postgres → migrator → app の順に起動
```

イメージは2つに分けてある。アプリのコンテナに Prisma CLI やシードスクリプトを載せないため。k8s では migrator が Job、runner が Deployment にあたる。起動前に一度 `bun run deploy:prepare`（マイグレーション適用＋鍵の保守）を通す。

CI は `.github/workflows/` にある。`ci.yml` が型・lint・ビルドと、実際の PostgreSQL を立てての検証（申請フローの安全性、署名鍵、認可コードフロー）。`image.yml` が compose の定義でイメージを作り ghcr.io に公開する。**ArgoCD には `sha-<短いSHA>` タグを指すこと**（ブランチ名や `latest` は中身が入れ替わって追えなくなる）。

バックアップと復元の手順は [docs/backup.md](docs/backup.md)。**DB のダンプだけでは復元できない**（中身がルート秘密で暗号化されている）ので、必ず読むこと。

## 検証

認可コードフローは `bun run e2e` で自動検証している。RP 側の検証は `openid-client` に任せているため、署名・`iss`・`aud`・`nonce`・PKCE・`state` の往復はライブラリが仕様どおりに確かめる。

申請フローの安全性（ステータス詐称の拒否、未承認ユーザーの遮断）は `bun run verify:apply` で検証している。

署名鍵は90日で自動ローテーションし、退役後7日は JWKS に残して発行済みトークンの検証を続ける。期限の設定・暗号文の再暗号化・古い鍵の削除はデプロイ時の `bun run deploy:prepare` がまとめて行うので、Pod に入って手で叩く必要はない。状態は管理画面（署名鍵）と `bun run jwks` で見られる。鍵が本当に使えるかは `bun run verify:jwks` で確認する。運用手順は [docs/key-rotation.md](docs/key-rotation.md)。

## ライセンス

未定。
