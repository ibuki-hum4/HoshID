# k8s

| | |
|---|---|
| ドメイン | `hoshid.skyia.jp`（issuer は `https://hoshid.skyia.jp/api/auth`） |
| レジストリ | `ghcr.io/ibuki-hum4` |
| Ingress | Traefik |
| Secret | kubeseal（Sealed Secrets） |

## デプロイ

```bash
git tag v0.1.0
git push origin v0.1.0
```

1. CI（[image.yml](../.github/workflows/image.yml)）が2つのイメージに `v0.1.0` を付けて ghcr.io へ push
2. ArgoCD Image Updater が最新の `vX.Y.Z` を拾い、[kustomization.yaml](kustomization.yaml) を書き換えて Git に commit
3. ArgoCD が同期。PreSync で [migrate-job.yaml](migrate-job.yaml) が先に走る

Image Updater が入っていない場合は、`kustomization.yaml` の `newTag` を手で
書き換えて push すれば同じ結果になる。

**中身が入れ替わるタグは使わない。** CI はブランチ名や `latest` を付けない。
`vX.Y.Z` は一度きりなので、本番から指しても「いま何が動いているか」が Git を
見れば分かる。

### 戻すとき

`kustomization.yaml` の `newTag` を前の版に戻して push する。
**マイグレーションは戻らない。** スキーマを変えた版から戻すなら、先にそれを
打ち消す新しいマイグレーションが要る。

## 初回

### 1. DB

[postgres.yaml](postgres.yaml) の StatefulSet で立つ。`secret.yaml` の
`POSTGRES_PASSWORD` と `DATABASE_URL` のパスワードを**同じ値に揃える**こと。
片方だけ変えると繋がらない。

`replicas` は 1 のまま。Postgres は複製の調停を自分でやらないので、増やすと
データが割れる。

### 2. Secret

[secret.yaml](secret.yaml)（`.gitignore` 済み）に平文で書いて、封をする。

```bash
kubeseal --cert k8s/cert.pem -f k8s/secret.yaml -o yaml > k8s/sealed-secret.yaml
```

`sealed-secret.yaml` は Git に入れる（クラスタの鍵でしか開けない）。
`cert.pem` も公開鍵なので入れてよく、あるとクラスタに繋がずに封をできる。

> **`BETTER_AUTH_SECRET` の平文を別の場所に控える。** SealedSecret はクラスタの
> 鍵でしか開けないので、クラスタごと失うと元の値も失う。この値を失うと署名鍵
> だけでなく **2FA の TOTP シークレットも読めなくなり、二要素認証を設定して
> いる人が全員締め出される。**

### 3. `TRUSTED_PROXIES`

```bash
kubectl get pod -n kube-system -l app.kubernetes.io/name=traefik -o wide
```

Traefik の Pod が属する CIDR を [configmap.yaml](configmap.yaml) に入れる。
**間違っているとクライアント IP を特定できず、レート制限が全員で1つのバケツに
なる**（ログインは10秒3回）。気づける形では壊れない。

### 4. 適用して、初代管理者を作る

```bash
kubectl apply -f k8s/argocd-application.yaml

kubectl -n hoshid run seed --rm -it --restart=Never \
  --image=ghcr.io/ibuki-hum4/hoshid-migrator:v0.1.0 \
  --env=SEED_ADMIN_EMAIL=... --env=SEED_ADMIN_PASSWORD=... \
  --overrides='{"spec":{"containers":[{"name":"seed","envFrom":[{"secretRef":{"name":"hoshid-secrets"}},{"configMapRef":{"name":"hoshid-config"}}]}]}}' \
  -- bun run seed:admin
```

これを飛ばすと**全員が prepared のまま、承認できる人が誰もいない**状態になる。

### 5. Discord のロール同期を確かめる

```bash
kubectl -n hoshid run discord-check --rm -it --restart=Never \
  --image=ghcr.io/ibuki-hum4/hoshid-migrator:v0.1.0 \
  -- bun run discord:sync
```

突き合わせは「HoshID と繋がっていない人からロールを外す」動きを含む。何人から
外れるかを見てから [CronJob](discord-sync-cronjob.yaml) を有効にする。

## バックアップ

[backup-cronjob.yaml](backup-cronjob.yaml) が毎日 `pg_dump` して PVC に7世代残す。
**クラスタ内なので、クラスタごと失えば一緒に消える。** 外へ持ち出す部分は
コメントアウトしてあり、そこを埋めるまでは「Pod が壊れたとき」にしか効かない。

> **ダンプとルート秘密は組。** DB の中身は `BETTER_AUTH_SECRET` で暗号化されて
> いるので、ダンプだけ戻しても読めない。復元したら必ず `bun run verify:secrets`
> を通すこと。方針と手順は [docs/backup.md](../docs/backup.md)。

## 未完了

- [ ] **バックアップをクラスタの外へ出す。** 保管先が未定
- [ ] **`TRUSTED_PROXIES` を実際の値にする。** いまは `10.42.0.0/16` の決め打ち
- [ ] **Ingress の `certresolver`。** `letsencrypt` 決め打ちなので、Traefik 側の
      resolver 名と合っているか確認する
- [ ] **復元を一度試す。** 試していないバックアップはバックアップではない

## 構成

| ファイル | 中身 |
|---|---|
| `postgres.yaml` | PostgreSQL（StatefulSet + headless Service） |
| `deployment.yaml` | アプリ本体（runner イメージ） |
| `migrate-job.yaml` | マイグレーション＋鍵の保守。ArgoCD の PreSync |
| `backup-cronjob.yaml` | 日次の `pg_dump`。7世代 |
| `discord-sync-cronjob.yaml` | Discord ロールの突き合わせ。毎時 |
| `configmap.yaml` | 秘密でない設定 |
| `secret.yaml` | 平文。**Git に入れない**（封をする元） |
| `sealed-secret.yaml` | 封をしたもの。Git に入れる |
| `ingress.yaml` | Traefik。証明書の出所はクラスタ側に合わせる |
| `argocd-application.yaml` | ArgoCD に手で適用する |
