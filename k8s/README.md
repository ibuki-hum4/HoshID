# k8s

| | |
|---|---|
| ドメイン | `hoshid.skyia.jp`（issuer は `https://hoshid.skyia.jp/api/auth`） |
| レジストリ | ghcr.io |
| Ingress | Traefik |
| Secret | kubeseal（Sealed Secrets） |

`OWNER` と `sha-REPLACE` は実際の値に置き換えること。

## 初回

**1. DB。** [postgres.yaml](postgres.yaml) の StatefulSet で立つ。設定は不要だが、
`secret.yaml` の `POSTGRES_PASSWORD` と `DATABASE_URL` のパスワードを
**同じ値に揃える**こと。片方だけ変えると繋がらない。

> `replicas` は 1 のまま。Postgres は複製の調停を自分でやらないので、
> 増やすとデータが割れる。

バックアップは [backup-cronjob.yaml](backup-cronjob.yaml) が毎日 `pg_dump` して
PVC に7世代残す。**ただしクラスタ内なので、クラスタごと失えば一緒に消える。**
外へ持ち出す部分はコメントアウトしてあり、そこを埋めるまでは「Pod が壊れたとき」
にしか効かない。方針と復元手順は [docs/backup.md](../docs/backup.md)。

> **ダンプとルート秘密は組。** DB の中身は `BETTER_AUTH_SECRET` で暗号化されて
> いるので、ダンプだけ戻しても読めない。復元したら必ず `bun run verify:secrets`
> を通すこと。

## 未完了

- [ ] **バックアップをクラスタの外へ出す。** 保管先が未定。決まるまでは
      クラスタが飛べばバックアップも一緒に飛ぶ
- [ ] **`TRUSTED_PROXIES` を実際の値にする**（[configmap.yaml](configmap.yaml)）。
      いまは `10.42.0.0/16` の決め打ち
- [ ] **復元を一度試す。** 試していないバックアップはバックアップではない
      （[docs/backup.md](../docs/backup.md)）

**2. Secret を作る。** [secret.yaml](secret.yaml) に平文で書いて、封をする。

```bash
kubeseal --cert k8s/cert.pem -f k8s/secret.yaml -o yaml > k8s/sealed-secret.yaml
```

`secret.yaml` は `.gitignore` 済み。`sealed-secret.yaml` は Git に入れて、
[kustomization.yaml](kustomization.yaml) の `resources` に追加する。
`cert.pem` は公開鍵なので Git に入れてよく、あるとクラスタに繋がずに封をできる。

> **`BETTER_AUTH_SECRET` の平文を別の場所に控える。** SealedSecret は
> クラスタの鍵でしか開けないので、クラスタごと失うと元の値も失う。この値を
> 失うと署名鍵だけでなく **2FA の TOTP シークレットも読めなくなり、二要素認証を
> 設定している人が全員締め出される。**

**3. `TRUSTED_PROXIES` を確認する**（[configmap.yaml](configmap.yaml)）。

```bash
kubectl get pod -n kube-system -l app.kubernetes.io/name=traefik -o wide
```

Traefik の Pod が属する CIDR を入れる。**空のままにすると、クライアント IP を
特定できずレート制限が全員で1つのバケツになる**（ログインは10秒3回）。
気づける形では壊れないので、ここは必ず埋める。

**4. 適用して、初代管理者を作る。**

```bash
kubectl apply -f k8s/argocd-application.yaml

kubectl -n hoshid run seed --rm -it --restart=Never \
  --image=ghcr.io/OWNER/hoshid-migrator:sha-REPLACE \
  --env=SEED_ADMIN_EMAIL=... --env=SEED_ADMIN_PASSWORD=... \
  --overrides='{"spec":{"containers":[{"name":"seed","envFrom":[{"secretRef":{"name":"hoshid-secrets"}},{"configMapRef":{"name":"hoshid-config"}}]}]}}' \
  -- bun run seed:admin
```

これを飛ばすと**全員が prepared のまま承認できる人が誰もいない**状態になる。

**5. Discord のロール同期を有効にする前に、一度 dry-run する。**

```bash
kubectl -n hoshid run discord-check --rm -it --restart=Never \
  --image=ghcr.io/OWNER/hoshid-migrator:sha-REPLACE \
  -- bun run discord:sync
```

突き合わせは「HoshID と繋がっていない人からロールを外す」動きを含む。
何人から外れるかを見てから [CronJob](discord-sync-cronjob.yaml) を有効にする。

## デプロイ

```bash
git tag v0.1.0
git push origin v0.1.0
```

これだけ。あとは自動で流れる。

1. CI（[image.yml](../.github/workflows/image.yml)）が2つのイメージに `v0.1.0` を付けて ghcr.io へ push
2. ArgoCD Image Updater が最新の `vX.Y.Z` を拾い、[kustomization.yaml](kustomization.yaml) を書き換えて Git に commit
3. ArgoCD が同期。PreSync で [migrate-job.yaml](migrate-job.yaml) が先に走る

**ArgoCD Image Updater が要る。** 入っていない場合は `kustomization.yaml` の
`newTag` を手で書き換えて push すれば同じ結果になる。

**中身が入れ替わるタグは使わない。** CI はブランチ名や `latest` のタグを
付けない。`vX.Y.Z` は一度きりなので、本番から指しても「いま何が動いているか」が
Git を見れば分かる。

### 戻すとき

`kustomization.yaml` の `newTag` を前の版に戻して push する。
**マイグレーションは戻らない。** スキーマを変えた版から戻す場合は、
先にそのマイグレーションを打ち消す新しいマイグレーションが要る。

## 構成

| ファイル | 中身 |
|---|---|
| `deployment.yaml` | アプリ本体（runner イメージ） |
| `migrate-job.yaml` | マイグレーション＋鍵の保守。ArgoCD の PreSync |
| `discord-sync-cronjob.yaml` | Discord ロールの突き合わせ。毎時 |
| `configmap.yaml` | 秘密でない設定 |
| `sealed-secret.example.yaml` | Secret の作り方（雛形。そのまま適用しない） |
| `ingress.yaml` | Traefik。証明書の出所はクラスタ側に合わせる |
| `argocd-application.yaml` | ArgoCD に手で適用する |
