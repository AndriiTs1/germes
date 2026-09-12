-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'POTENTIAL', 'INACTIVE', 'BLOCKED');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'POTENTIAL',
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "country" TEXT,
    "creditLimit" DECIMAL(14,2),
    "paymentTermDays" INTEGER NOT NULL DEFAULT 0,
    "responsibleId" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "lastPurchaseAt" TIMESTAMP(3),
    "nextActionAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customers_responsibleId_idx" ON "customers"("responsibleId");

-- CreateIndex
CREATE INDEX "customers_lastContactAt_idx" ON "customers"("lastContactAt");

-- CreateIndex
CREATE INDEX "customers_lastPurchaseAt_idx" ON "customers"("lastPurchaseAt");

-- CreateIndex
CREATE INDEX "customers_nextActionAt_idx" ON "customers"("nextActionAt");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
