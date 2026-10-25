-- 管理者がアプリを止めたかどうかを持つ。
-- 停止そのものは oauth_client.disabled が担う（Better Auth がそこを見て弾く）。
-- こちらは「管理者が止めたので所有者は再開できない」を判定するための印。
ALTER TABLE "oauth_client_trust" ADD COLUMN "adminDisabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "oauth_client_trust" ADD COLUMN "adminDisabledBy" TEXT;
ALTER TABLE "oauth_client_trust" ADD COLUMN "adminDisabledAt" TIMESTAMP(3);
