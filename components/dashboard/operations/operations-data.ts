import type { LucideIcon } from "lucide-react";

export type AttentionAccent = "rose" | "amber" | "violet" | "blue";

export type AttentionKind =
  | "overdueCustomerPayments"
  | "supplierInvoiceAwaitingApproval"
  | "lowStock"
  | "supplierPaymentDueTomorrow"
  | "ordersAwaitingShipment";

export type AttentionItem = {
  icon: LucideIcon;
  kind: AttentionKind;
  productName?: string;
  value?: string;
  count?: number;
  accent: AttentionAccent;
};
