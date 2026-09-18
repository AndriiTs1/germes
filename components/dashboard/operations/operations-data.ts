import {
  CalendarClock,
  CircleAlert,
  ClipboardCheck,
  Drumstick,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type AttentionAccent = "rose" | "amber" | "violet" | "blue";

/** Stable key into dictionary.commandCenter.needsAttention — the item's label is never stored here. */
export type AttentionKind =
  | "overdueCustomerPayments"
  | "supplierInvoiceAwaitingApproval"
  | "lowStock"
  | "supplierPaymentDueTomorrow"
  | "ordersAwaitingShipment";

export type AttentionItem = {
  icon: LucideIcon;
  kind: AttentionKind;
  /** Only present for kind: "lowStock" — the untouched demo product name, composed after the localized "Low stock:" prefix at render time. */
  productName?: string;
  value: string;
  accent: AttentionAccent;
};

export const needsAttention: AttentionItem[] = [
  {
    icon: CircleAlert,
    kind: "overdueCustomerPayments",
    value: "2 340 000 UAH",
    accent: "rose",
  },
  {
    icon: ClipboardCheck,
    kind: "supplierInvoiceAwaitingApproval",
    value: "640 000 UAH",
    accent: "violet",
  },
  {
    icon: Drumstick,
    kind: "lowStock",
    productName: "Chicken Fillet",
    value: "0 kg",
    accent: "amber",
  },
  {
    icon: CalendarClock,
    kind: "supplierPaymentDueTomorrow",
    value: "1 200 000 UAH",
    accent: "violet",
  },
  {
    icon: Truck,
    kind: "ordersAwaitingShipment",
    value: "5 orders",
    accent: "blue",
  },
];

export type RecentOrder = {
  id: string;
  customer: string;
  amount: string;
  isToday: boolean;
  /** Day-of-month and 0-indexed month — only present when !isToday; the locale-correct short month name is resolved at render time (see components/ui/date-input.tsx's convention). */
  day?: number;
  monthIndex?: number;
  /** "HH:MM" — digits only, never localized text. */
  time: string;
};

export const recentOrders: RecentOrder[] = [
  { id: "#SO-1028", customer: "Meat House", amount: "1 240 000 UAH", isToday: true, time: "14:32" },
  { id: "#SO-1027", customer: "Fresh Market", amount: "420 000 UAH", isToday: true, time: "11:18" },
  {
    id: "#SO-1026",
    customer: "Restaurant Group",
    amount: "980 000 UAH",
    isToday: false,
    day: 10,
    monthIndex: 8,
    time: "16:05",
  },
  {
    id: "#SO-1025",
    customer: "Local Retail",
    amount: "320 000 UAH",
    isToday: false,
    day: 10,
    monthIndex: 8,
    time: "12:41",
  },
  {
    id: "#SO-1024",
    customer: "Food Service",
    amount: "640 000 UAH",
    isToday: false,
    day: 9,
    monthIndex: 8,
    time: "18:22",
  },
];

export type PaymentStatus = "overdue" | "neutral" | "positive" | "upcoming";

/** Stable key into dictionary.commandCenter.paymentCalendar.events — the event's label is never stored here. */
export type PaymentEventType = "supplierPayment" | "taxPayment" | "customerReceipt";

export type PaymentEvent = {
  day: string;
  /** 0-indexed month — the locale-correct short month name is resolved at render time. */
  monthIndex: number;
  eventType: PaymentEventType;
  amount: string;
  status: PaymentStatus;
};

export const paymentCalendar: PaymentEvent[] = [
  { day: "8", monthIndex: 8, eventType: "supplierPayment", amount: "640 000 UAH", status: "overdue" },
  { day: "10", monthIndex: 8, eventType: "taxPayment", amount: "320 000 UAH", status: "neutral" },
  { day: "12", monthIndex: 8, eventType: "customerReceipt", amount: "1 200 000 UAH", status: "positive" },
  { day: "15", monthIndex: 8, eventType: "supplierPayment", amount: "780 000 UAH", status: "upcoming" },
  { day: "18", monthIndex: 8, eventType: "customerReceipt", amount: "2 100 000 UAH", status: "positive" },
];
