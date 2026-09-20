# HoshID

セルフホストの **OpenID Connect Provider**。

自分のサービス群を RP（Relying Party）としてぶら下げるための一次認証基盤で、外部 IdP へのフェデレーションは行わない。エンドユーザーの認証手段はパスワード（Argon2id）・Passkey・TOTP による 2FA。

## 構成

| 領域 | 採用 |
|---|---|
| フレームワーク | Next.js 16（App Router / Turbopack） |
| 認証基盤 | Better Auth + `@better-auth/oauth-provider`（OAuth 2.1 Provider） |
| 署名鍵 / JWKS | Better Auth `jwt()` プラグイン（EdDSA / Ed25519） |
| UI | shadcn/ui + Tailwind CSS v4 |
| DB | PostgreSQL + Prisma 7 |
| dev | Podman |
| prod | k8s + ArgoCD |

## セットアップ

```bash
bun install
cp .env.example .env.local        # BETTER_AUTH_SECRET を埋める
openssl rand -base64 32           # ↑ 用のシークレット生成

bun run db:up                     # PostgreSQL を起動
bun run db:migrate                # スキーマ適用（prisma migrate dev）
bun run dev
```

## 実装状況

- [x] **M1** — アカウント申請 / 未承認ユーザーの遮断 / パスワードログイン / Authorization Code + PKCE / Discovery / JWKS / ID トークン / UserInfo / 同意画面 / Refresh Token
- [ ] **M2** — 申請の承認・却下画面 / ロール（admin・役員）/ 承認メール送信
- [ ] **M3** — Passkey（WebAuthn）/ TOTP 2FA / `acr`・`amr` クレーム / アカウント設定画面
- [ ] **M4** — Client Credentials / Device Code / Introspection・Revocation の公開 / 動的クライアント登録 / RP-Initiated Logout
- [ ] **M5** — k8s 本番化 / 鍵ローテーション運用 / 監査ログ

アカウントは**自由に作成できず、申請 → 管理者承認**を経て有効になる。詳細は [CLAUDE.md](CLAUDE.md)。

M1 は `scripts/e2e-authorization-code.ts` で検証済み（discovery / 同意 / ID トークン署名検証 / UserInfo / リフレッシュ / 認可コード再利用の拒否まで全 PASS）。

## issuer

この IdP の issuer は origin ではなく **`<origin>/api/auth`**。RP にはこの値を設定する。Discovery は `<origin>/api/auth/.well-known/openid-configuration`。

## ライセンス

未定。
