-- CreateTable
CREATE TABLE "user_link" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_link_userId_idx" ON "user_link"("userId");

-- AddForeignKey: Prisma のリレーションを張っていないので外部キーはここで明示する
ALTER TABLE "user_link"
  ADD CONSTRAINT "user_link_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
