-- AlterTable
ALTER TABLE "user" ADD COLUMN     "displayUsername" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "member_request" (
    "id" UUID NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "applicantName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "decidedById" UUID,
    "userId" UUID,

    CONSTRAINT "member_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_request_status_idx" ON "member_request"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- AddForeignKey
ALTER TABLE "member_request" ADD CONSTRAINT "member_request_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_request" ADD CONSTRAINT "member_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
