# Kubernetes デプロイメント

## デプロイ前チェックリスト

- [ ] `NEXT_PUBLIC_APP_URL`: 本番ドメイン (例: `https://hoshid.example.com`)
- [ ] `BETTER_AUTH_SECRET`: 32文字以上のランダム文字列 (`openssl rand -base64 32`)
- [ ] `POSTGRES_PASSWORD`: 強いパスワード
- [ ] Docker レジストリアクセス認証
- [ ] Kubernetes クラスタへのアクセス
- [ ] DNS設定完了
- [ ] SSL/TLS証明書（Ingress用）

## 環境変数設定表

| 変数 | 場所 | 説明 | 例 |
|------|------|------|-----|
| `PORT` | ConfigMap | アプリケーションポート | `3000` |
| `NODE_ENV` | ConfigMap | 実行環境 | `production` |
| `NEXT_PUBLIC_APP_URL` | ConfigMap | アプリケーションURL | `https://hoshid.example.com` |
| `DATABASE_URL` | ConfigMap | PostgreSQL接続文字列 | `postgres://hoshid_user:password@db-service.hoshid.svc.cluster.local:5432/hoshid?sslmode=require` |
| `BETTER_AUTH_SECRET` | Secret | JWT署名用秘密鍵 | (32文字以上ランダム) |
| `POSTGRES_USER` | Secret | PostgreSQLユーザー | `hoshid_user` |
| `POSTGRES_PASSWORD` | Secret | PostgreSQLパスワード | (強いパスワード) |
| `POSTGRES_DB` | Secret | PostgreSQLデータベース名 | `hoshid` |

## デプロイメント手順

### 1. Docker イメージのビルド＆プッシュ

```bash
cd frontend

# ビルド
docker build -t hoshid/frontend:latest -f Dockerfile .

# プッシュ（例: Docker Hub）
docker tag hoshid/frontend:latest docker.io/yourname/hoshid/frontend:latest
docker push docker.io/yourname/hoshid/frontend:latest
```

### 2. Secret & ConfigMap の編集

**必須: 本番用の認証情報に変更してください**

#### k8s/secret.yaml を編集
```bash
# Base64エンコードした値を生成
echo -n "your-strong-password-here" | base64
echo -n "your-secret-min-32-chars-here-1234567890-random" | base64
```

例:
```yaml
data:
  BETTER_AUTH_SECRET: "YWJjZDEyMzQ1Njc4OTBhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eg=="  # 32文字以上
  POSTGRES_USER: "aG9zaGlkX3VzZXI="  # hoshid_user
  POSTGRES_PASSWORD: "U3Ryb25nUGFzc3dvcmQxMjM0NTY="  # 強いパスワード
  POSTGRES_DB: "aG9zaGlk"  # hoshid
```

#### k8s/configmap.yaml を編集
```yaml
data:
  PORT: "3000"
  NODE_ENV: "production"
  NEXT_PUBLIC_APP_URL: "https://hoshid.example.com"  # 実際のドメイン
  DATABASE_URL: "postgres://hoshid_user:password@db-service.hoshid.svc.cluster.local:5432/hoshid?sslmode=require"
```

### 3. Docker レジストリ設定

**イメージをプッシュ：**
```bash
cd frontend

# ビルド
docker build -t hoshid/frontend:latest -f Dockerfile .

# Docker Hubにプッシュ
docker tag hoshid/frontend:latest docker.io/yourusername/hoshid/frontend:latest
docker login docker.io
docker push docker.io/yourusername/hoshid/frontend:latest

# または GCR
docker tag hoshid/frontend:latest gcr.io/your-project/hoshid/frontend:latest
docker push gcr.io/your-project/hoshid/frontend:latest
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

```bash
# 全リソースをデプロイ
kubectl apply -k k8s/

# または個別デプロイ
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/db/
kubectl apply -f k8s/frontend/
```

### 4. Kubernetes マニフェストの適用

```bash
# 全リソースをデプロイ
kubectl apply -k k8s/

# または個別デプロイ
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
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

**PostgreSQL に手動で挿入:**

```bash
# Pod に接続
kubectl exec -it -n hoshid <postgres-pod-name> -- psql -U hoshid_user -d hoshid
```

PostgreSQL シェルで実行：
```sql
INSERT INTO "user" (id, email, name, role, status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@hoshid.local',
  'Administrator',
  'admin',
  'active',
  now(),
  now()
);

-- 確認
SELECT id, email, role FROM "user";
```

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
