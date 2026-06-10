# Kubernetes デプロイメント

## デプロイ前チェックリスト

- [ ] `NEXT_PUBLIC_APP_URL`: 本番ドメイン (例: `https://hoshid.example.com`)
- [ ] `BETTER_AUTH_SECRET`: 32文字以上のランダム文字列 (`openssl rand -base64 32`)
- [ ] `OIDC_JWK_CURRENT`: OIDC署名鍵 (`node scripts/generate-oidc-jwk.mjs` で生成。手順は後述)
- [ ] `POSTGRES_PASSWORD` / `DATABASE_URL`: 強いパスワードに変更し、両者を整合させる
- [ ] SMTP設定（メールアドレス確認・パスワードリセットの送信に必須）
- [ ] コンテナレジストリアクセス認証（Podman）
- [ ] Kubernetes クラスタへのアクセス
- [ ] DNS設定完了
- [ ] SSL/TLS証明書（Ingress用）

## 環境変数設定表

| 変数 | 場所 | 必須 | 説明 | 例 |
|------|------|------|------|-----|
| `PORT` | ConfigMap | 必須 | アプリケーションポート | `3000` |
| `NODE_ENV` | ConfigMap | 必須 | 実行環境 | `production` |
| `NEXT_PUBLIC_APP_URL` | ConfigMap | 必須 | アプリケーションURL（OIDC issuer / コールバックURLにも使用） | `https://hoshid.example.com` |
| `TZ` | ConfigMap | 任意 | タイムゾーン | `Asia/Tokyo` |
| `OIDC_AUDIENCE` | ConfigMap | 任意 | OIDCトークンのaudience（未設定時は `hoshid-go-api`） | `hoshid-go-api` |
| `OIDC_GO_CLIENT_ID` / `OIDC_GO_REDIRECT_URLS` / `OIDC_GO_SKIP_CONSENT` / `OIDC_GO_CLIENT_NAME` | ConfigMap | 任意 | Go API等の信頼済みOIDCクライアント設定 | - |
| `BETTER_AUTH_SECRET` | Secret | 必須 | Better Auth / ダッシュボードJWT署名用秘密鍵 | (32文字以上ランダム) |
| `DATABASE_URL` | Secret | 必須 | PostgreSQL接続文字列（パスワードを含むためSecretで管理） | `postgres://hoshid_user:password@db-service.hoshid.svc.cluster.local:5432/hoshid?sslmode=disable` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Secret | 必須 | `k8s/db/statefulset.yaml`（同梱のPostgreSQL）が使用 | - |
| `OIDC_JWK_CURRENT` | Secret | **必須** | OIDC JWT署名鍵（JSON）。未設定だとJWKSが空になりトークン検証が壊れる | 後述の生成手順を参照 |
| `OIDC_JWK_PREVIOUS` | Secret | 任意 | 鍵ローテーション時に旧鍵を一時的に検証可能にする | 同上 |
| `OIDC_ADMIN_BOOTSTRAP_TOKEN` | Secret | 任意 | `/api/admin/oauth/clients/go` 用の管理トークン。未設定時は常に401 | - |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_TLS_REJECT_UNAUTHORIZED` | Secret | 実質必須 | メール確認・パスワードリセット送信用SMTP設定（接続情報・認証情報ともSecretで管理） | - |
| `OIDC_GO_CLIENT_SECRET` | Secret | 任意 | 信頼済みOIDCクライアントのシークレット | - |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Secret | 任意 | ソーシャルログイン（設定したプロバイダのみ有効化） | - |

> 既定の `k8s/` マニフェストは PostgreSQL を `k8s/db/statefulset.yaml`
> （StatefulSet + 動的プロビジョニングPVC、10Gi）としてクラスタ内に同梱する。
> マネージドDB（Cloud SQL / RDS等）を使う場合は `k8s/kustomization.yaml` から
> `db/service.yaml` と `db/statefulset.yaml` を削除し、`DATABASE_URL` を
> マネージドDBのホスト名（`sslmode=require` 推奨）に変更すればよい。

## OIDC署名鍵の生成

`OIDC_JWK_CURRENT` は `/api/auth/jwks`（JWKSエンドポイント）と OIDC トークンの
署名・検証に使われる必須の値。未設定のままデプロイすると、リプレイカや再起動の
たびに異なる使い捨て鍵が生成され、JWKSは常に空集合を返すため、発行した
ID/アクセストークンを外部クライアントが検証できない状態になる。

```bash
cd frontend
node scripts/generate-oidc-jwk.mjs
```

出力された1行のJSONをそのまま `OIDC_JWK_CURRENT` の値として設定する
（`.env.production.example` 参照）。Secretへ反映する場合は
`kubectl create secret generic` を使うのが簡単（後述）。

鍵をローテーションする場合は、現在の `OIDC_JWK_CURRENT` の値を
`OIDC_JWK_PREVIOUS` にコピーしてから、新しく生成した値を
`OIDC_JWK_CURRENT` に設定する（旧鍵で発行済みのトークンが期限切れになるまで
`OIDC_JWK_PREVIOUS` を残す）。

## デプロイメント手順

### 1. Podman イメージのビルド＆プッシュ

アプリ本体（`runner` ステージ）に加えて、Prisma CLI を含む `migrator` ステージも
マイグレーションJob用にビルド＆プッシュする（standalone 出力には Prisma CLI が
含まれないため、マイグレーションは別イメージで実行する）。

```bash
cd frontend

# アプリ本体（runner ステージ）
podman build -t hoshid/frontend:latest -f Dockerfile .
podman tag hoshid/frontend:latest docker.io/yourname/hoshid/frontend:latest
podman push docker.io/yourname/hoshid/frontend:latest

# マイグレーション用（migrator ステージ）
podman build --target migrator -t hoshid/frontend:migrate -f Dockerfile .
podman tag hoshid/frontend:migrate docker.io/yourname/hoshid/frontend:migrate
podman push docker.io/yourname/hoshid/frontend:migrate
```

### 2. Secret の作成 & ConfigMap の編集

**必須: 本番用の認証情報に変更してください**

Secret (`hoshid-secrets`) の値はリポジトリのファイルに直書きしない。
`kubectl create secret generic` でクラスタに直接作成するのが唯一の
推奨手順（上記「環境変数設定表」と「OIDC署名鍵の生成」を参照）。
`k8s/secret.example.yaml` はキー一覧と `OIDC_JWK_CURRENT` のJSON形式を
確認するための参考用テンプレートであり、`k8s/kustomization.yaml` の
`resources` には含まれていない（= `kubectl apply -k k8s/` では作成されない）。

```bash
kubectl create namespace hoshid

kubectl create secret generic hoshid-secrets -n hoshid \
  --from-literal=BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  --from-literal=POSTGRES_USER=hoshid_user \
  --from-literal=POSTGRES_PASSWORD="<strong-password>" \
  --from-literal=POSTGRES_DB=hoshid \
  --from-literal=DATABASE_URL="postgres://hoshid_user:<strong-password>@db-service.hoshid.svc.cluster.local:5432/hoshid?sslmode=disable" \
  --from-literal=OIDC_JWK_CURRENT="$(node frontend/scripts/generate-oidc-jwk.mjs)" \
  --from-literal=SMTP_HOST="smtp.example.com" \
  --from-literal=SMTP_PORT="587" \
  --from-literal=SMTP_USER="smtp-user" \
  --from-literal=SMTP_PASS="<smtp-password>" \
  --from-literal=SMTP_FROM="noreply@hoshid.example.com" \
  --from-literal=SMTP_TLS_REJECT_UNAUTHORIZED="true"
```

> 任意項目（`OIDC_JWK_PREVIOUS` / `OIDC_ADMIN_BOOTSTRAP_TOKEN` /
> `OIDC_GO_CLIENT_SECRET` / `GOOGLE_CLIENT_SECRET` / `GITHUB_CLIENT_SECRET` など）が
> 必要な場合は、上記コマンドに `--from-literal=KEY=value` を追加する。
> 作成済みの Secret にキーを追加・変更する場合（`kubectl create` は
> 既存 Secret に対して使えないため）は次のいずれかを使う:
> ```bash
> kubectl patch secret hoshid-secrets -n hoshid \
>   -p '{"stringData":{"OIDC_JWK_PREVIOUS":"<value>"}}'
> # または
> kubectl edit secret hoshid-secrets -n hoshid
> ```

#### k8s/configmap.yaml を編集
```yaml
data:
  PORT: "3000"
  NODE_ENV: "production"
  NEXT_PUBLIC_APP_URL: "https://hoshid.example.com"  # 実際のドメイン
  TZ: "Asia/Tokyo"
  OIDC_AUDIENCE: "hoshid-go-api"
```

### 3. コンテナレジストリ設定（Podman）

**イメージをプッシュ：**
```bash
cd frontend

# ビルド
podman build -t hoshid/frontend:latest -f Dockerfile .

# Docker Hubにプッシュ
podman tag hoshid/frontend:latest docker.io/yourusername/hoshid/frontend:latest
podman login docker.io
podman push docker.io/yourusername/hoshid/frontend:latest

# または GCR
podman tag hoshid/frontend:latest gcr.io/your-project/hoshid/frontend:latest
podman push gcr.io/your-project/hoshid/frontend:latest
```

**kustomization.yaml でイメージを更新：**
```yaml
images:
  - name: hoshid/frontend
    newName: docker.io/yourusername/hoshid/frontend  # 実際のレジストリ
    newTag: latest
```

**プライベートレジストリの場合、imagePullSecrets を追加：**
```bash
kubectl create secret docker-registry regcred \
  --docker-server=docker.io \
  --docker-username=yourusername \
  --docker-password=yourtoken \
  -n hoshid
```

k8s/frontend/deployment.yaml に追加：
```yaml
spec:
  template:
    spec:
      imagePullSecrets:
        - name: regcred
```

### 4. Kubernetes マニフェストの適用

`hoshid-secrets` Secret が未作成の場合、Pod は Secret 参照キーを解決できず
起動に失敗する。必ず手順2で `hoshid-secrets` を作成してから適用すること。

```bash
# 全リソースをデプロイ
kubectl apply -k k8s/

# または個別デプロイ
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/db/
kubectl apply -f k8s/frontend/
```

### 5. Prisma マイグレーション

```bash
# マイグレーション実行
kubectl apply -f k8s/frontend/migration-job.yaml

# 完了待機
kubectl wait --for=condition=complete job/prisma-migrate -n hoshid --timeout=300s

# 確認
kubectl logs -n hoshid job/prisma-migrate
```

### 6. 管理者ユーザーの作成

`https://<本番ドメイン>/setup` にアクセスして初期セットアップフォームから
管理者アカウント（メールアドレス・パスワード）を作成する
（`frontend/app/setup/page.tsx`）。このページはDBに `role: "admin"` の
ユーザーが1件も存在しない間だけ表示され、作成済みの場合は自動的に
`/sign-in` にリダイレクトされる。

セットアップ完了後、Better Auth の `account`（パスワードハッシュ）と
`user`（`role: "admin"`）の両方が正しく作成されていることを確認する：

```bash
kubectl exec -it -n hoshid <postgres-pod-name> -- \
  psql -U hoshid_user -d hoshid -c \
  'SELECT id, email, role, "emailVerified" FROM "user";'
```

> 旧手順（PostgreSQLへの直接INSERT）は `account`（パスワードハッシュ）が
> 作成されずログイン不能になるため使用しないこと。

### 7. デプロイ確認

```bash
# Pod 状態確認
kubectl get pods -n hoshid

# ログ確認
kubectl logs -n hoshid -l app=frontend -f

# サービス確認
kubectl get svc -n hoshid
```

## トラブルシューティング

```bash
# Pod の詳細確認
kubectl describe pod -n hoshid <pod-name>

# 環境変数確認
kubectl exec -it -n hoshid <pod-name> -- env

# リソース使用状況
kubectl top pod -n hoshid
```
