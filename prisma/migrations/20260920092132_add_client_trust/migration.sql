-- DropForeignKey
ALTER TABLE "avatar" DROP CONSTRAINT "avatar_userId_fkey";

-- CreateTable
CREATE TABLE "oauth_client_trust" (
    "clientId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_client_trust_pkey" PRIMARY KEY ("clientId")
);

-- AddForeignKey: クライアントを消したら検証記録も消えること
ALTER TABLE "oauth_client_trust"
  ADD CONSTRAINT "oauth_client_trust_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "oauthClient"("clientId")
  ON DELETE CASCADE ON UPDATE CASCADE;
