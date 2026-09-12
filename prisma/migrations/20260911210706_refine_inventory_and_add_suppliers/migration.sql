/*
  Warnings:

  - You are about to drop the column `quantityKg` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `warehouseId` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `stock_movements` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'POTENTIAL', 'IN_PROGRESS', 'INACTIVE', 'BLOCKED');

-- DropForeignKey
ALTER TABLE "batches" DROP CONSTRAINT "batches_warehouseId_fkey";

-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_productId_fkey";

-- DropIndex
DROP INDEX "batches_productId_idx";

-- DropIndex
DROP INDEX "batches_warehouseId_idx";

-- DropIndex
DROP INDEX "stock_movements_productId_idx";

-- AlterTable
ALTER TABLE "batches" DROP COLUMN "quantityKg",
DROP COLUMN "warehouseId";

-- AlterTable
ALTER TABLE "stock_movements" DROP COLUMN "productId";

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'POTENTIAL',
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "country" TEXT,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER,
    "responsibleId" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "nextActionAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE INDEX "suppliers_responsibleId_idx" ON "suppliers"("responsibleId");

-- CreateIndex
CREATE INDEX "suppliers_lastContactAt_idx" ON "suppliers"("lastContactAt");

-- CreateIndex
CREATE INDEX "suppliers_nextActionAt_idx" ON "suppliers"("nextActionAt");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
