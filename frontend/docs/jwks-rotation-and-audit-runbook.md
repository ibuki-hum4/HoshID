# JWKS ローテーション & 監査ログ ランブック

概要
- 目的: 本番運用で JWKS のキー管理（ローテーション・公開・検証）を安全に、ゼロダウンタイムで実行する手順と、監査ログの取得方法を定義する。
- 前提: `better-auth` と `@better-auth/oauth-provider` を利用し、アプリは JWKS を `/.well-known/jwks.json` などで公開する。

重要な設計方針
- 常に複数の鍵を JWKS に含め、`kid` を使って検証側が古い鍵／新しい鍵を切り替えられること。
- 秘密鍵の保管は K8s Secret / cloud KMS（例: AWS KMS/Secrets Manager, GCP KMS/Secret Manager）を推奨。
- ローテーションは "準備 -> 公開（複数鍵）-> 移行期間 -> 廃棄" の流れで行う。
- 監査ログは署名操作、管理 API 呼び出し（クライアント登録/更新/削除）、キー変更イベントを記録する。

Prerequisites
- Kubernetes クラスタ、`kubectl` 権限
- KMS または安全なシークレットストア
- 運用者用の管理トークン（`OIDC_ADMIN_BOOTSTRAP_TOKEN` など）を安全に管理
- 本番用環境変数と ConfigMap/Secret の運用手順

運用手順（手動）
1. 新しい鍵ペアを生成
   - RSA 例: `openssl genpkey -algorithm RSA -out new.key -pkeyopt rsa_keygen_bits:3072` と `openssl rsa -pubout -in new.key -out new.pub`。
   - EC (P-256): `openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out new.key` など。

2. 秘密鍵を安全に保存
   - K8s: `kubectl create secret generic oidc-jwk-new --from-file=privateKey=new.key --from-file=publicKey=new.pub -n <namespace>`
   - Cloud KMS: 秘密鍵を KMS に登録し、公開用 JWK を構成管理に保存

3. 公開 JWKS を更新（ゼロダウンタイム）
   - 方式 A (推奨): 新しい鍵を DB / 設定に追加し、既存の公開 JWKS に `kid` と共に新鍵の公開部分を追加する。
   - 方式 B: 新しい `OIDC_JWKS_JSON` を配置してアプリを再読み込み（ただし一時的な同期問題に注意）。

4. 移行期間
   - 新しい鍵で発行されたトークンと古い鍵で発行されたトークンが並存する期間を運用ポリシーで定義（例: トークン最大寿命 + 数分）。
   - 移行期間中、検証サービスは JWKS に含まれる全 `kid` を受け付ける。

5. 廃棄
   - すべての既存トークンが期限切れになったことを確認後、古い鍵を JWKS から削除し、秘密鍵を安全に破棄する。

自動化（Kubernetes 例）
- CronJob/Job を使ったキー作成ワークフローの例（概念）:

```yaml
# k8s-job-create-jwk.yaml (概念)
apiVersion: batch/v1
kind: Job
metadata:
  name: oidc-jwk-rotate
spec:
  template:
    spec:
      containers:
        - name: rotate
          image: appropriate/curl
          command: ["/bin/sh","-c"]
          args:
            - |
              # 1) Generate key via KMS or in-container tool
              # 2) Upload private to KMS / Secret Manager
              # 3) POST new public JWK to admin endpoint (or update DB directly)
              echo "rotate"
      restartPolicy: Never
```

- ベストプラクティス: 秘密鍵はコンテナ内で生成してはならない。必ず KMS を利用するか、信頼できるシークレット管理フローで配布する。

監査ログ
- 監査対象:
  - 管理 API 呼び出し（クライアント作成/更新/削除、キー追加/削除）
  - JWKS 公開の変更（誰がいつどのキーを追加/削除したか）
  - トークン発行・更新・失効イベント（可能な限り）
- ログ保管:
  - 読み取り専用の監査ログストレージに転送（例: ELK, Splunk, Cloud Logging）
  - ログは改竄不可能にする（WORM ストレージ / 署名）
- ログの最小項目: タイムスタンプ, イベントタイプ, 実行者, 対象 (client_id or kid), 成功/失敗, 変更差分

検証手順
- 新鍵追加後、次を実行して検証:
  - `curl -s https://<issuer>/.well-known/jwks.json` で `kid` が存在することを確認
  - 新しい鍵で ID/Access トークンを発行して、検証サービスが検証できることを確認

緊急ロールバック
- 古い鍵をすぐに再投下できるよう、廃棄前は古い鍵を安全にアーカイブしておく。
- 誤ったキーが公開された場合は、即時にその `kid` を JWKS から削除し、必要に応じてクライアントを再発行。

運用チェックリスト
- [ ] KMS/Secret Manager に鍵が登録されている
- [ ] JWKS に新しい `kid` が追加されている
- [ ] 発行/検証テストを通過した
- [ ] 監査ログにイベントが記録されている
- [ ] 古い鍵の安全な保管（または破棄）を実施

付録: ブートストラップ API の確認コマンド（ローカル）

```bash
# 前提: サーバが http://localhost:3000 で起動
curl -X POST http://localhost:3000/api/admin/oauth/clients/go \
  -H "Content-Type: application/json" \
  -H "x-admin-bootstrap-token: ${OIDC_ADMIN_BOOTSTRAP_TOKEN}" \
  -d '{"redirectUris":["http://localhost:8080/callback"]}'
```


---
注: このファイルは運用のための作業指示テンプレートです。実際の環境では KMS の種類や組織ポリシーに合わせて手順をカスタマイズしてください。