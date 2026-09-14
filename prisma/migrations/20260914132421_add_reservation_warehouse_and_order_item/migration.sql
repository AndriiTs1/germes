-- AlterTable
ALTER TABLE "stock_reservations" ADD COLUMN     "salesOrderItemId" TEXT,
ADD COLUMN     "warehouseId" TEXT;

-- CreateIndex
CREATE INDEX "stock_reservations_warehouseId_idx" ON "stock_reservations"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_reservations_salesOrderItemId_idx" ON "stock_reservations"("salesOrderItemId");

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "sales_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
