-- AlterTable: add bodyHash column to IdempotencyRecord for body-change detection
ALTER TABLE "IdempotencyRecord" ADD COLUMN "bodyHash" TEXT;
