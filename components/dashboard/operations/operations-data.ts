import type { LucideIcon } from "lucide-react";

export type AttentionAccent = "rose" | "amber" | "violet" | "blue";

export type AttentionKind =
  | "overdueCustomerPayments"
  | "openSupplierPayables"
  | "lowStock"
  | "supplierPaymentDueTomorrow"
  | "confirmedOrdersAwaitingProcessing";

export type AttentionItem = {
  icon: LucideIcon;
  kind: AttentionKind;
  productName?: string;
  value?: string;
  money?: { amount: string; currency: string };
  count?: number;
  accent: AttentionAccent;
};
