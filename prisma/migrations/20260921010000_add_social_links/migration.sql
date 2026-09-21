-- CreateTable
CREATE TABLE "social_link" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "profileUrl" TEXT,
    "showContributions" BOOLEAN NOT NULL DEFAULT false,
    "contributions" JSONB,
    "contributionsFetchedAt" TIMESTAMP(3),
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_link_userId_idx" ON "social_link"("userId");

-- 1人につき同じサービスは1つ
CREATE UNIQUE INDEX "social_link_userId_provider_key" ON "social_link"("userId", "provider");

-- 同じ外部アカウントを複数の HoshID アカウントに紐づけさせない。
-- できると1つの Discord アカウントで何人分もの申請を裏付けられ、
-- 本人確認の意味が消える。
CREATE UNIQUE INDEX "social_link_provider_providerAccountId_key"
  ON "social_link"("provider", "providerAccountId");

-- AddForeignKey: User を消したら連携も消えること
ALTER TABLE "social_link"
  ADD CONSTRAINT "social_link_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
