import type { SalesManagerKey, WarehouseCode } from "./master-data";

/*
 * In-memory shape of the DEMO 100M dataset. Field names follow
 * prisma/schema.prisma; master data is referenced by code / SKU / user key
 * (real ids are resolved only by a future apply phase). Money is integer
 * minor units (kopecks / euro cents), quantities are integer kg, instants
 * are ISO strings.
 */

export type Currency = "UAH" | "EUR";
export type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "PROCESSING" | "READY" | "SHIPPED" | "COMPLETED" | "CANCELLED";
export type ReservationStatus = "ACTIVE" | "RELEASED" | "EXPIRED" | "CONSUMED";
export type FinanceStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
export type PurchaseOrderStatus = "DRAFT" | "CONFIRMED" | "CLOSED" | "CANCELLED";
export type MovementType = "RECEIPT" | "SHIPMENT" | "TRANSFER" | "WRITE_OFF" | "ADJUSTMENT";

export type UserKey = SalesManagerKey | "warehouse" | "warehouse2" | "accounting" | "procurement";

export type CustomerUpdate = {
  customerCode: string;
  paymentTermDays: number;
  /** Minor units UAH, or null (no limit). */
  creditLimit: number | null;
  lastPurchaseAt: string | null;
  lastContactAt: string | null;
  nextActionAt: string | null;
  /** Generator-side attention group (reporting only; not a schema field). */
  attentionGroup: "active" | "nextActionSoon" | "nextActionOverdue" | "staleContact" | "stalePurchase" | "noSignals";
};

export type SupplierUpdate = { supplierCode: string; paymentTermDays: number };

export type SalesOrderItem = {
  id: string;
  salesOrderId: string;
  productSku: string;
  quantityKg: number;
  /** Minor units per kg (2 decimals). */
  pricePerKg: number;
};

export type SalesOrder = {
  id: string;
  orderNumber: string;
  customerCode: string;
  responsible: SalesManagerKey;
  status: SalesOrderStatus;
  currency: Currency;
  orderDate: string;
  shippedAt: string | null;
  createdAt: string;
  notes: string;
  items: SalesOrderItem[];
};

export type Batch = {
  id: string;
  batchNumber: string;
  productSku: string;
  warehouseCode: WarehouseCode;
  supplierCode: string;
  receivedKg: number;
  receivedAt: string;
  productionDate: string;
  expiryDate: string;
  /** Minor units UAH per kg; null for EUR-invoiced batches (no FX). */
  unitCost: number | null;
  status: "AVAILABLE";
  notes: string;
};

export type StockMovement = {
  id: string;
  type: MovementType;
  batchId: string;
  fromWarehouseCode: WarehouseCode | null;
  toWarehouseCode: WarehouseCode | null;
  quantityKg: number;
  reference: string;
  notes: string;
  createdAt: string;
};

export type StockReservation = {
  id: string;
  productSku: string;
  batchId: string;
  warehouseCode: WarehouseCode;
  salesOrderId: string;
  salesOrderItemId: string;
  quantityKg: number;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string;
  notes: string;
};

export type Receivable = {
  id: string;
  customerCode: string;
  salesOrderId: string;
  amount: number;
  paidAmount: number;
  currency: Currency;
  dueDate: string;
  status: FinanceStatus;
  reference: string;
  notes: string;
  createdAt: string;
};

export type PaymentEvent = {
  receivableId: string;
  salesOrderId: string;
  amount: number;
  at: string;
};

export type PurchaseOrderItem = { id: string; productSku: string; quantityKg: number; pricePerKg: number | null };

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierCode: string;
  destinationWarehouseCode: WarehouseCode | null;
  status: PurchaseOrderStatus;
  currency: Currency;
  orderDate: string | null;
  expectedArrivalDate: string | null;
  createdAt: string;
  notes: string;
  items: PurchaseOrderItem[];
};

export type Payable = {
  id: string;
  supplierCode: string;
  amount: number;
  paidAmount: number;
  currency: Currency;
  dueDate: string;
  status: FinanceStatus;
  reference: string;
  notes: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actor: UserKey | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DemoDataset = {
  version: string;
  seed: string;
  asOf: string;
  timeZone: string;
  customerUpdates: CustomerUpdate[];
  supplierUpdates: SupplierUpdate[];
  salesOrders: SalesOrder[];
  reservations: StockReservation[];
  batches: Batch[];
  movements: StockMovement[];
  receivables: Receivable[];
  paymentEvents: PaymentEvent[];
  purchaseOrders: PurchaseOrder[];
  payables: Payable[];
  auditLogs: AuditLog[];
};
