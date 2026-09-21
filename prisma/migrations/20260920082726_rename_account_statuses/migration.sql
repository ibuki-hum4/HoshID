-- アカウントのステータスを Prepared / Active / Rejected / Archived / Suspended に再定義する。
--   pending  -> prepared  （申請済み・未審査。意味は同じ）
--   approved -> active    （承認済み・利用可能。意味は同じ）
-- rejected はそのまま。archived と suspended は今回から使い始めるため既存行は無い。
--
-- ログインを許可するのは active だけ。値がズレると誰もログインできなくなるか、
-- 逆に未承認のまま通ってしまうので、既定値の変更と同じマイグレーションで行う。

UPDATE "user" SET "status" = 'prepared' WHERE "status" = 'pending';
UPDATE "user" SET "status" = 'active'   WHERE "status" = 'approved';

ALTER TABLE "user" ALTER COLUMN "status" SET DEFAULT 'prepared';
