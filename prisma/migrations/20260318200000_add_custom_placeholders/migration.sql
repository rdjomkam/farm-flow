-- CreateEnum
CREATE TYPE "PlaceholderMode" AS ENUM ('MAPPING', 'FORMULA');

-- CreateEnum
CREATE TYPE "PlaceholderFormat" AS ENUM ('NUMBER', 'TEXT');

-- CreateTable
CREATE TABLE "CustomPlaceholder" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "example" TEXT NOT NULL,
    "mode" "PlaceholderMode" NOT NULL,
    "sourcePath" TEXT,
    "formula" TEXT,
    "format" "PlaceholderFormat" NOT NULL DEFAULT 'NUMBER',
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPlaceholder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomPlaceholder_key_key" ON "CustomPlaceholder"("key");
