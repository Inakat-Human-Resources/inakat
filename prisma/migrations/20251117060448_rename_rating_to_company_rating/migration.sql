/*
  Warnings:

  - You are about to drop the column `rating` on the `Job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "rating",
ADD COLUMN     "companyRating" DOUBLE PRECISION DEFAULT 5.0;
