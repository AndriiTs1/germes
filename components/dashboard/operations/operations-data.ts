import {
  CalendarClock,
  CircleAlert,
  ClipboardCheck,
  Drumstick,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type AttentionAccent = "rose" | "amber" | "violet" | "blue";

export type AttentionItem = {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: AttentionAccent;
};

export const needsAttention: AttentionItem[] = [
  {
    icon: CircleAlert,
    label: "Overdue customer payments",
    value: "2 340 000 UAH",
    accent: "rose",
  },
  {
    icon: ClipboardCheck,
    label: "Supplier invoice awaiting approval",
    value: "640 000 UAH",
    accent: "violet",
  },
  {
    icon: Drumstick,
    label: "Low stock: Chicken Fillet",
    value: "0 kg",
    accent: "amber",
  },
  {
    icon: CalendarClock,
    label: "Supplier payment due tomorrow",
    value: "1 200 000 UAH",
    accent: "violet",
  },
  {
    icon: Truck,
    label: "Orders awaiting shipment",
    value: "5 orders",
    accent: "blue",
  },
];

export type RecentOrder = {
  id: string;
  customer: string;
  amount: string;
  timestamp: string;
  isToday: boolean;
};

export const recentOrders: RecentOrder[] = [
  { id: "#SO-1028", customer: "Meat House", amount: "1 240 000 UAH", timestamp: "Today, 14:32", isToday: true },
  { id: "#SO-1027", customer: "Fresh Market", amount: "420 000 UAH", timestamp: "Today, 11:18", isToday: true },
  { id: "#SO-1026", customer: "Restaurant Group", amount: "980 000 UAH", timestamp: "10 Sep, 16:05", isToday: false },
  { id: "#SO-1025", customer: "Local Retail", amount: "320 000 UAH", timestamp: "10 Sep, 12:41", isToday: false },
  { id: "#SO-1024", customer: "Food Service", amount: "640 000 UAH", timestamp: "9 Sep, 18:22", isToday: false },
];

export type PaymentStatus = "overdue" | "neutral" | "positive" | "upcoming";

export type PaymentEvent = {
  day: string;
  month: string;
  event: string;
  amount: string;
  status: PaymentStatus;
  statusLabel: string;
};

export const paymentCalendar: PaymentEvent[] = [
  { day: "8", month: "Sep", event: "Supplier payment", amount: "640 000 UAH", status: "overdue", statusLabel: "Overdue" },
  { day: "10", month: "Sep", event: "Tax payment", amount: "320 000 UAH", status: "neutral", statusLabel: "Scheduled" },
  { day: "12", month: "Sep", event: "Customer receipt", amount: "1 200 000 UAH", status: "positive", statusLabel: "Incoming" },
  { day: "15", month: "Sep", event: "Supplier payment", amount: "780 000 UAH", status: "upcoming", statusLabel: "Upcoming" },
  { day: "18", month: "Sep", event: "Customer receipt", amount: "2 100 000 UAH", status: "positive", statusLabel: "Incoming" },
];
