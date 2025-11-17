/*
  Warnings:

  - You are about to drop the column `companyId` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `companyRating` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `isRemote` on the `Job` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_companyId_fkey";

-- DropIndex
DROP INDEX "Job_companyId_idx";

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "companyId",
DROP COLUMN "companyRating",
DROP COLUMN "isRemote",
ADD COLUMN     "rating" DOUBLE PRECISION DEFAULT 5.0,
ADD COLUMN     "userId" INTEGER,
ADD COLUMN     "workMode" TEXT NOT NULL DEFAULT 'presential';

-- CreateIndex
CREATE INDEX "Job_userId_idx" ON "Job"("userId");

-- CreateIndex
CREATE INDEX "Job_workMode_idx" ON "Job"("workMode");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
