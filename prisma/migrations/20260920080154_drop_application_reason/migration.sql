/*
  Warnings:

  - You are about to drop the column `applicationReason` on the `user` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_link" DROP CONSTRAINT "user_link_userId_fkey";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "applicationReason";
