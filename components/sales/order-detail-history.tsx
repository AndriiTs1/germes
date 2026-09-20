import { DetailSection } from "@/components/sales/detail-section";
import { formatMoney } from "@/components/sales/format";
import { INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SalesOrderHistoryItem } from "@/lib/services/sales/get-sales-order-history";

type Metadata = Record<string, unknown>;

function asMetadata(value: unknown): Metadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Metadata)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function formatHistoryTimestamp(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Kyiv",
  }).format(new Date(value));
}

function historyTitle(
  item: SalesOrderHistoryItem,
  t: Dictionary["orderDetail"]["history"],
): string {
  if (item.entityType === "SalesOrder") {
    switch (item.action) {
      case "CREATE":
        return t.events.orderCreated;
      case "UPDATE":
        return t.events.orderUpdated;
      case "CONFIRM":
        return t.events.orderConfirmed;
      case "START_PROCESSING":
        return t.events.orderProcessing;
      case "MARK_READY":
        return t.events.orderReady;
      case "SHIP":
        return t.events.orderShipped;
      case "CANCEL":
        return t.events.orderCancelled;
      default:
        return item.action;
    }
  }

  if (item.entityType === "StockReservation") {
    switch (item.action) {
      case "CREATE":
        return t.events.reservationCreated;
      case "RELEASE":
        return t.events.reservationReleased;
      case "EXPIRE":
        return t.events.reservationExpired;
      case "CONSUME":
        return t.events.reservationConsumed;
      default:
        return item.action;
    }
  }

  if (item.entityType === "Receivable") {
    switch (item.action) {
      case "CREATE":
        return t.events.receivableCreated;
      case "REGISTER_PAYMENT":
        return t.events.paymentRegistered;
      default:
        return item.action;
    }
  }

  return item.action;
}

function historyDetail(
  item: SalesOrderHistoryItem,
  locale: Locale,
  t: Dictionary["orderDetail"]["history"],
): string | null {
  const metadata = asMetadata(item.metadata);

  if (item.entityType === "Receivable" && item.action === "REGISTER_PAYMENT") {
    const paymentAmount = stringValue(metadata.paymentAmount);
    const outstandingAmount = stringValue(metadata.outstandingAmount);
    const currency = stringValue(metadata.currency) ?? "UAH";

    if (paymentAmount && outstandingAmount) {
      return `${formatMoney(paymentAmount, currency, locale)} · ${t.outstanding} ${formatMoney(
        outstandingAmount,
        currency,
        locale,
      )}`;
    }
  }

  if (item.entityType === "Receivable" && item.action === "CREATE") {
    const amount = stringValue(metadata.amount);
    const currency = stringValue(metadata.currency) ?? "UAH";

    if (amount) {
      return formatMoney(amount, currency, locale);
    }
  }

  if (item.entityType === "StockReservation") {
    const quantityKg = stringValue(metadata.quantityKg);
    const batchNumber = stringValue(metadata.batchNumber);
    const warehouseCode = stringValue(metadata.warehouseCode);

    return [quantityKg ? `${quantityKg} kg` : null, batchNumber, warehouseCode]
      .filter(Boolean)
      .join(" · ") || null;
  }

  const fromStatus = stringValue(metadata.fromStatus);
  const toStatus = stringValue(metadata.toStatus);

  if (fromStatus && toStatus) {
    return `${fromStatus} → ${toStatus}`;
  }

  return null;
}

export function OrderDetailHistory({
  items,
  locale,
  dictionary,
}: {
  items: SalesOrderHistoryItem[];
  locale: Locale;
  dictionary: Dictionary;
}) {
  if (items.length === 0) return null;

  const t = dictionary.orderDetail.history;

  return (
    <DetailSection title={t.title}>
      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const actor = item.actorName ?? item.actorEmail ?? t.system;
          const detail = historyDetail(item, locale, t);

          return (
            <div
              key={item.id}
              className="grid gap-1 py-3 first:pt-0 last:pb-0 md:grid-cols-[150px_minmax(0,1fr)_180px] md:items-start md:gap-4"
            >
              <div className="text-[12px] text-slate-400">
                {formatHistoryTimestamp(item.createdAt, locale)}
              </div>

              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-slate-900">
                  {historyTitle(item, t)}
                </div>
                {detail ? (
                  <div className="mt-0.5 text-[12px] text-slate-500">
                    {detail}
                  </div>
                ) : null}
              </div>

              <div className="text-[12px] text-slate-500 md:text-right">
                {actor}
              </div>
            </div>
          );
        })}
      </div>
    </DetailSection>
  );
}
