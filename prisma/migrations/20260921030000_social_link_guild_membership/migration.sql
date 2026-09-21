-- Discord のサーバに参加しているかを持つ。
-- ロールを付けようとした結果（404 なら未参加）から分かるので、そのときに書く。
-- 画面の一覧から毎回 Discord に問い合わせると遅く、レート制限にも当たる。
ALTER TABLE "social_link" ADD COLUMN "inGuild" BOOLEAN;
ALTER TABLE "social_link" ADD COLUMN "guildCheckedAt" TIMESTAMP(3);
