import { SalesOrderStatus } from "@/lib/generated/prisma/client";

/**
 * V1 business thresholds for the SALES workspace. Defined once here so no
 * service hardcodes a duplicate magic number.
 */

/** A customer with no contact in this many days is flagged as stale. */
export const STALE_CONTACT_DAYS = 21;

/** A customer with no purchase in this many days is flagged as stale. */
export const STALE_PURCHASE_DAYS = 45;

/** A receivable due within this many days (and not yet overdue) is "due soon". */
export const RECEIVABLE_DUE_SOON_DAYS = 7;

/** An active reservation expiring within this many hours is "expiring soon". */
export const RESERVATION_EXPIRING_SOON_HOURS = 24;

/** SalesOrder statuses considered finished — excluded from "active" order views. */
export const TERMINAL_SALES_ORDER_STATUSES: SalesOrderStatus[] = [
  SalesOrderStatus.COMPLETED,
  SalesOrderStatus.CANCELLED,
];
