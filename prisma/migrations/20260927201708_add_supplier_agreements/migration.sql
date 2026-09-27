-- CreateEnum
CREATE TYPE "SupplierAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentDueBasis" AS ENUM ('ORDER_DATE', 'INVOICE_DATE', 'RECEIPT_DATE');

-- CreateEnum
CREATE TYPE "Incoterm" AS ENUM ('EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF');

-- CreateTable
CREATE TABLE "supplier_agreements" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "status" "SupplierAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "prepaymentPercent" INTEGER,
    "balanceDueDays" INTEGER,
    "balanceDueBasis" "PaymentDueBasis",
    "paymentTermsNote" TEXT,
    "incoterm" "Incoterm",
    "incotermVersion" INTEGER,
    "incotermPlace" TEXT,
    "defaultLeadTimeDays" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_agreement_items" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "leadTimeDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_agreement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_agreement_price_tiers" (
    "id" TEXT NOT NULL,
    "agreementItemId" TEXT NOT NULL,
    "minQuantityKg" DECIMAL(14,3) NOT NULL,
    "pricePerKg" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_agreement_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_agreements_supplierId_status_idx" ON "supplier_agreements"("supplierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_agreements_supplierId_agreementNumber_key" ON "supplier_agreements"("supplierId", "agreementNumber");

-- CreateIndex
CREATE INDEX "supplier_agreement_items_productId_idx" ON "supplier_agreement_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_agreement_items_agreementId_productId_key" ON "supplier_agreement_items"("agreementId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_agreement_price_tiers_agreementItemId_minQuantityK_key" ON "supplier_agreement_price_tiers"("agreementItemId", "minQuantityKg");

-- AddForeignKey
ALTER TABLE "supplier_agreements" ADD CONSTRAINT "supplier_agreements_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_agreements" ADD CONSTRAINT "supplier_agreements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_agreement_items" ADD CONSTRAINT "supplier_agreement_items_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "supplier_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_agreement_items" ADD CONSTRAINT "supplier_agreement_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_agreement_price_tiers" ADD CONSTRAINT "supplier_agreement_price_tiers_agreementItemId_fkey" FOREIGN KEY ("agreementItemId") REFERENCES "supplier_agreement_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
