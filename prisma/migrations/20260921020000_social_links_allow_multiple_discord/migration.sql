-- Discord は1人が複数のアカウントを繋げるようにする。
-- 「1人につき1サービス1つ」をやめ、GitHub にだけ条件付きで残す。
DROP INDEX "social_link_userId_provider_key";

-- GitHub は1人1つ。プロフィールに出す性質のもので、複数あっても
-- どれを出すのか決められない。
CREATE UNIQUE INDEX "social_link_userId_github_key"
  ON "social_link"("userId")
  WHERE "provider" = 'github';

-- 同じ外部アカウントを複数の HoshID アカウントに紐づけない制約
-- （social_link_provider_providerAccountId_key）はそのまま残す。
-- 1つの Discord アカウントで何人分もの申請を裏付けられては、
-- 本人確認の意味が消えるため。
