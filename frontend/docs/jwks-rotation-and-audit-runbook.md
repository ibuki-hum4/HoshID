# JWKS ローテーション & 監査ログ ランブック

## 概要
- 目的: 本番運用で OIDC 署名鍵（JWKS）のローテーション・公開・検証を安全に、ゼロダウンタイムで実行する手順と、監査ログの確認方法を定義する。
- 実装: `better-auth` の `jwt` プラグイン（`frontend/lib/auth.ts`）が
  `OIDC_JWKS_PATH`（既定 `/api/auth/jwks`）で JWKS を公開する。鍵セットは
  DBではなく環境変数から読み込まれる（`adapter.getJwks` =
  `loadRotationKeysFromEnv()`、`frontend/src/features/oauth/security/jwks.ts`）。

重要な設計方針
- 鍵は環境変数 `OIDC_JWK_CURRENT`（必須）/ `OIDC_JWK_PREVIOUS`（任意）で管理する。
  両方が JWKS に `kid` 付きで公開され、検証側はどちらの `kid` で署名された
  トークンも検証できる。
- ローテーションは "新鍵を生成 -> 旧鍵を `OIDC_JWK_PREVIOUS` に退避 -> 新鍵を
  `OIDC_JWK_CURRENT` に設定 -> ロールアウト -> 移行期間後に旧鍵を削除" の
  流れで行う（DBマイグレーションや管理APIの呼び出しは不要）。
- Secret の値はリポジトリのファイルに書き込まない。`kubectl create secret
  generic` / `kubectl patch secret` でクラスタに直接投入する
  （`K8S_DEPLOYMENT.md` 参照）。

## 鍵のフォーマット

`OIDC_JWK_CURRENT` / `OIDC_JWK_PREVIOUS` は、それぞれ次の形式の JSON を
**1行**で設定する。`publicKey` / `privateKey` は jose の `exportJWK()` の
戻り値を **JSON文字列化したもの**（二重エンコード）である点に注意:

```json
{
  "id": "2026-06-10-aaaaaaaa",
  "publicKey": "{\"kty\":\"OKP\",\"crv\":\"Ed25519\",\"x\":\"...\"}",
  "privateKey": "{\"kty\":\"OKP\",\"crv\":\"Ed25519\",\"d\":\"...\",\"x\":\"...\"}",
  "alg": "EdDSA",
  "crv": "Ed25519",
  "createdAt": "2026-06-10T00:00:00.000Z",
  "expiresAt": "2026-07-10T00:00:00.000Z"
}
```

- `id` は JWKS の `kid` として公開される一意な文字列。
- `expiresAt` は任意。`loadRotationKeysFromEnv()` はこの値で自動失効はしない
  ため、あくまで「いつ `OIDC_JWK_PREVIOUS` を削除してよいか」の運用上の目安。
- `OIDC_JWKS_JSON` に上記オブジェクトの **配列** を設定すると、
  `OIDC_JWK_CURRENT` / `OIDC_JWK_PREVIOUS` より優先して使われる
  （3鍵以上を一括管理したい場合のみ使用）。

## Prerequisites
- Kubernetes クラスタへの `kubectl` アクセス（`hoshid` namespace）
- `frontend` の Node.js 実行環境（`node scripts/generate-oidc-jwk.mjs` の実行用）
- 構造化監査ログ（後述）の閲覧権限

## 1. 新しい鍵ペアの生成

```bash
cd frontend
node scripts/generate-oidc-jwk.mjs
```

`scripts/generate-oidc-jwk.mjs` は jose の
`generateKeyPair("EdDSA", { crv: "Ed25519" })` で鍵ペアを生成し、上記フォーマットの
JSONを1行で標準出力する（`id` は `randomUUID()`、`createdAt` は実行時刻）。

## 2. 鍵をSecretへ反映

通常運用（初回設定）では `OIDC_JWK_CURRENT` のみを設定する:

```bash
kubectl create secret generic hoshid-secrets -n hoshid \
  --from-literal=OIDC_JWK_CURRENT="$(node scripts/generate-oidc-jwk.mjs)" \
  ... # 他の必須キーは K8S_DEPLOYMENT.md を参照
```

既存の `hoshid-secrets` を更新する場合（`kubectl create` は既存Secretには
使えない）は `kubectl patch` または `kubectl edit` を使う:

```bash
kubectl patch secret hoshid-secrets -n hoshid --type merge \
  -p "{\"stringData\":{\"OIDC_JWK_CURRENT\": $(node scripts/generate-oidc-jwk.mjs | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}}"
```

> `kubectl patch ... --type merge` で `stringData` に値を設定すると、
> Kubernetes側で対応する `data` キーがbase64で更新される
> （手元でbase64エンコードする必要はない）。

## 3. ローテーション手順（ゼロダウンタイム）

1. **現在の鍵を退避する**: 現在の `OIDC_JWK_CURRENT` の値を取得する。
   ```bash
   kubectl get secret hoshid-secrets -n hoshid \
     -o jsonpath='{.data.OIDC_JWK_CURRENT}' | base64 -d
   ```
   必要であれば取得した値に `expiresAt`（旧鍵で発行したトークンの最大寿命 +
   バッファ程度の未来日時）を追記しておくと、削除タイミングの目安になる。

2. **退避した値を `OIDC_JWK_PREVIOUS` に設定する**（手順2と同じ
   `kubectl patch` の要領で `OIDC_JWK_PREVIOUS` キーに設定）。

3. **新しい鍵を生成し `OIDC_JWK_CURRENT` に設定する**:
   ```bash
   node scripts/generate-oidc-jwk.mjs
   # 出力されたJSONを OIDC_JWK_CURRENT に kubectl patch で設定
   ```

4. **ロールアウト**:
   ```bash
   kubectl rollout restart deployment/frontend -n hoshid
   kubectl rollout status deployment/frontend -n hoshid
   ```

5. **検証**: `/api/auth/jwks`（= `https://<issuer>/api/auth/jwks`）に
   新旧両方の `kid` が含まれることを確認する（後述「検証手順」参照）。

## 4. 移行期間と廃棄

- 移行期間（旧鍵で発行されたトークンの最大寿命 + バッファ）は
  `OIDC_JWK_PREVIOUS` を残し、JWKSに両方の `kid` を公開し続ける。
- 移行期間が終了したら `OIDC_JWK_PREVIOUS` を削除する:
  ```bash
  kubectl patch secret hoshid-secrets -n hoshid --type=json \
    -p='[{"op":"remove","path":"/data/OIDC_JWK_PREVIOUS"}]'
  kubectl rollout restart deployment/frontend -n hoshid
  ```

## 監査ログ

`frontend/lib/audit.ts` の `auditLog()` が、1イベント1行のJSON
（`{ ts, service, env, event, details }`）を `stdout`（コンテナログ）に出力する。
`secret` / `token` / `password` / `private` / `key` / `jwks` を含むキーの値は
自動的にマスクされる。ログ収集基盤（Cloud Logging / ELK / Loki 等）で
`service: "frontend"` のJSONログとして取り込み、`event` でフィルタする。

- 監査対象イベント（実装済み）:
  - `jwks.parse_error` / `jwks.parse_failure` / `jwks.skip_malformed_entry`:
    `OIDC_JWK_CURRENT` / `OIDC_JWK_PREVIOUS` / `OIDC_JWKS_JSON` のJSONが
    壊れている場合に出力される（鍵設定ミスの早期検知に使う）。
  - `admin.bootstrap.*`: `/api/admin/oauth/clients/go`
    （`OIDC_ADMIN_BOOTSTRAP_TOKEN` を使う管理API）の呼び出し結果。
  - `admin.make-admin.*`: 初回セットアップ時の管理者ロール付与。
- ローテーション作業自体（`kubectl patch` 等）は Kubernetes の監査ログ
  （API server audit log）側に記録される。クラスタの audit policy で
  `secrets` リソースへの `patch`/`update` が記録対象になっていることを
  確認すること。

## 検証手順

ローテーション後、以下を確認する:

```bash
# 1. JWKS に新旧両方の kid が含まれること
curl -s https://<issuer>/api/auth/jwks | jq '.keys[].kid'

# 2. 新しい鍵で発行されたID/アクセストークンを、
#    JWKS経由で外部クライアント（Go API等）が検証できること
```

```bash
# 参考: ブートストラップAPIの動作確認（ローカル, OIDC_ADMIN_BOOTSTRAP_TOKEN設定時）
curl -X POST http://localhost:3000/api/admin/oauth/clients/go \
  -H "Content-Type: application/json" \
  -H "x-admin-bootstrap-token: ${OIDC_ADMIN_BOOTSTRAP_TOKEN}" \
  -d '{"redirectUris":["http://localhost:8080/callback"]}'
```

## 緊急ロールバック

- ロールアウト後に問題が発生した場合、`OIDC_JWK_CURRENT` と
  `OIDC_JWK_PREVIOUS` の値を入れ替えて（手順2と同じ `kubectl patch`）から
  `kubectl rollout restart deployment/frontend -n hoshid` する。
  旧鍵はまだ `OIDC_JWK_PREVIOUS` として削除していない前提。
- 誤った値を `OIDC_JWK_CURRENT` に設定してしまい、かつ `OIDC_JWK_PREVIOUS`
  も上書き済みの場合は、`node scripts/generate-oidc-jwk.mjs` で新規鍵を
  再生成し、`OIDC_JWK_CURRENT` に設定し直す（旧鍵で発行済みのトークンは
  検証不能になるため、影響範囲をユーザーに周知する）。

## 運用チェックリスト

- [ ] 新しい鍵を `node scripts/generate-oidc-jwk.mjs` で生成した
- [ ] 現在の `OIDC_JWK_CURRENT` を `OIDC_JWK_PREVIOUS` に退避した
- [ ] 新しい鍵を `OIDC_JWK_CURRENT` に設定した（ファイルに書き込まず
      `kubectl patch secret` で直接投入した）
- [ ] `kubectl rollout restart deployment/frontend -n hoshid` を実行した
- [ ] `/api/auth/jwks` に新旧両方の `kid` が含まれることを確認した
- [ ] 移行期間後に `OIDC_JWK_PREVIOUS` を削除した
- [ ] 監査ログ（`jwks.*` イベント）にエラーが出ていないことを確認した

---
注: このファイルは運用のための作業手順テンプレートです。クラスタ構成や
組織のシークレット管理ポリシーに合わせて適宜調整してください。
