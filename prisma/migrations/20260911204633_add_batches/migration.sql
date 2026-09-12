-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('AVAILABLE', 'QUARANTINE', 'BLOCKED', 'DEPLETED');

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantityKg" DECIMAL(14,3) NOT NULL,
    "receivedKg" DECIMAL(14,3),
    "productionDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "manufacturer" TEXT,
    "country" TEXT,
    "temperature" DECIMAL(5,2),
    "unitCost" DECIMAL(14,4),
    "status" "BatchStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batches_productId_idx" ON "batches"("productId");

-- CreateIndex
CREATE INDEX "batches_warehouseId_idx" ON "batches"("warehouseId");

-- CreateIndex
CREATE INDEX "batches_expiryDate_idx" ON "batches"("expiryDate");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "batches_batchNumber_productId_key" ON "batches"("batchNumber", "productId");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
