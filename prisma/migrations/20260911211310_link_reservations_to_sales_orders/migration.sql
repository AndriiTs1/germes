-- AlterTable
ALTER TABLE "stock_reservations" ADD COLUMN     "salesOrderId" TEXT;

-- CreateIndex
CREATE INDEX "stock_reservations_salesOrderId_idx" ON "stock_reservations"("salesOrderId");

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
