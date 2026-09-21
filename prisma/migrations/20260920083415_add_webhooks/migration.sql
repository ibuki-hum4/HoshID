-- CreateTable
CREATE TABLE "webhook" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'discord',
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_pkey" PRIMARY KEY ("id")
);
