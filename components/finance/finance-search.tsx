"use client";

import Link from "next/link";
import {
  Building2,
  LoaderCircle,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { formatMoney } from "@/components/sales/format";
import {
  INTL_LOCALE_MAP,
  type Locale,
} from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Balance = {
  currency: string;
  outstandingAmount: string;
  overdueAmount: string;
};

type SearchResults = {
  customers: {
    id: string;
    name: string;
    href: string;
    balances: Balance[];
  }[];
  suppliers: {
    id: string;
    name: string;
    href: string;
    balances: Balance[];
  }[];
  orders: {
    id: string;
    orderNumber: string;
    customerName: string;
    href: string;
    dueDate: string | null;
    balances: Balance[];
  }[];
};

const EMPTY: SearchResults = {
  customers: [],
  suppliers: [],
  orders: [],
};

function FinancialPosition({
  balances,
  locale,
  outstandingLabel,
  overdueLabel,
  emptyLabel,
}: {
  balances: Balance[];
  locale: Locale;
  outstandingLabel: string;
  overdueLabel: string;
  emptyLabel: string;
}) {
  if (balances.length === 0) {
    return (
      <p className="mt-0.5 text-[11px] text-slate-400">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="mt-0.5 space-y-0.5">
      {balances.map((balance) => {
        const hasOverdue =
          Number(balance.overdueAmount) > 0;

        return (
          <p
            key={balance.currency}
            className="text-[11px] leading-[1.35] text-slate-500"
          >
            {outstandingLabel}{" "}
            <span className="font-medium tabular-nums text-slate-700">
              {formatMoney(
                balance.outstandingAmount,
                balance.currency,
                locale,
              )}
            </span>

            {hasOverdue ? (
              <>
                {" · "}
                <span className="font-medium text-rose-600">
                  {overdueLabel}{" "}
                  {formatMoney(
                    balance.overdueAmount,
                    balance.currency,
                    locale,
                  )}
                </span>
              </>
            ) : null}
          </p>
        );
      })}
    </div>
  );
}

export function FinanceSearch({
  locale,
  dictionary,
  variant = "header",
}: {
  locale: Locale;
  dictionary: Dictionary;
  variant?: "header" | "mobile";
}) {
  const t = dictionary.finance.search;

  const rootRef =
    useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] =
    useState<SearchResults>(EMPTY);
  const [loading, setLoading] =
    useState(false);
  const [open, setOpen] = useState(false);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        setLoading(true);

        try {
          const response = await fetch(
            `/api/finance/search?q=${encodeURIComponent(
              trimmed,
            )}`,
            {
              signal: controller.signal,
            },
          );

          if (!response.ok) {
            setResults(EMPTY);
            return;
          }

          const data =
            (await response.json()) as SearchResults;

          setResults(data);
        } catch (error) {
          if (
            !(
              error instanceof DOMException &&
              error.name === "AbortError"
            )
          ) {
            setResults(EMPTY);
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      },
      220,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    function handlePointerDown(
      event: MouseEvent,
    ) {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
  }, []);

  const hasResults =
    results.customers.length > 0 ||
    results.suppliers.length > 0 ||
    results.orders.length > 0;

  const showPanel =
    open && trimmed.length >= 2;

  const dateFormatter =
    new Intl.DateTimeFormat(
      INTL_LOCALE_MAP[locale],
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );

  return (
    <div
      ref={rootRef}
      className={
        variant === "mobile"
          ? "relative block w-full"
          : "relative hidden min-w-0 flex-1 md:block md:max-w-[320px] xl:max-w-[520px]"
      }
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400"
        strokeWidth={1.75}
      />

      <input
        type="search"
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;

          setQuery(nextQuery);
          setOpen(true);

          if (nextQuery.trim().length < 2) {
            setResults(EMPTY);
            setLoading(false);
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={t.mobilePlaceholder}
        aria-label={t.ariaLabel}
        autoComplete="off"
        className="h-9 w-full rounded-full border border-slate-200/70 bg-slate-50 pr-10 pl-10 text-base text-slate-700 placeholder:text-slate-400 transition-all focus:border-slate-300 focus:bg-white focus:ring-[3px] focus:ring-slate-900/[0.04] focus:outline-none md:text-[13px]"
      />

      {loading ? (
        <LoaderCircle className="absolute top-1/2 right-3.5 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
      ) : null}

      {showPanel ? (
        <div className="absolute top-[44px] left-0 z-50 w-[min(620px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_60px_-22px_rgba(15,23,42,0.28)]">
          <div className="max-h-[480px] overflow-y-auto p-2">
            {!loading && !hasResults ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[12.5px] font-medium text-slate-700">
                  {t.emptyTitle}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t.emptyDescription}
                </p>
              </div>
            ) : null}

            {results.customers.length > 0 ? (
              <div>
                <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
                  {t.groups.customers}
                </p>

                {results.customers.map(
                  (customer) => (
                    <Link
                      key={customer.id}
                      href={customer.href}
                      onClick={() =>
                        setOpen(false)
                      }
                      className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <UserRound className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-slate-900">
                          {customer.name}
                        </p>

                        <FinancialPosition
                          balances={
                            customer.balances
                          }
                          locale={locale}
                          outstandingLabel={
                            t.receivable
                          }
                          overdueLabel={
                            t.overdue
                          }
                          emptyLabel={
                            t.noOpenReceivables
                          }
                        />
                      </div>
                    </Link>
                  ),
                )}
              </div>
            ) : null}

            {results.suppliers.length > 0 ? (
              <div className="mt-1 border-t border-slate-100 pt-1">
                <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
                  {t.groups.suppliers}
                </p>

                {results.suppliers.map(
                  (supplier) => (
                    <Link
                      key={supplier.id}
                      href={supplier.href}
                      onClick={() =>
                        setOpen(false)
                      }
                      className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-slate-900">
                          {supplier.name}
                        </p>

                        <FinancialPosition
                          balances={
                            supplier.balances
                          }
                          locale={locale}
                          outstandingLabel={
                            t.payable
                          }
                          overdueLabel={
                            t.overdue
                          }
                          emptyLabel={
                            t.noOpenPayables
                          }
                        />
                      </div>
                    </Link>
                  ),
                )}
              </div>
            ) : null}

            {results.orders.length > 0 ? (
              <div className="mt-1 border-t border-slate-100 pt-1">
                <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
                  {t.groups.orders}
                </p>

                {results.orders.map(
                  (order) => (
                    <Link
                      key={order.id}
                      href={order.href}
                      onClick={() =>
                        setOpen(false)
                      }
                      className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <ShoppingBag className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-slate-900">
                          {order.orderNumber}
                          <span className="font-normal text-slate-400">
                            {" · "}
                            {
                              order.customerName
                            }
                          </span>
                        </p>

                        <FinancialPosition
                          balances={
                            order.balances
                          }
                          locale={locale}
                          outstandingLabel={
                            t.balance
                          }
                          overdueLabel={
                            t.overdue
                          }
                          emptyLabel={
                            t.settled
                          }
                        />

                        {order.dueDate ? (
                          <p className="mt-0.5 text-[10.5px] text-slate-400">
                            {t.dueDate}:{" "}
                            {dateFormatter.format(
                              new Date(
                                order.dueDate,
                              ),
                            )}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ),
                )}
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[10.5px] text-slate-400">
            {t.hint}
          </div>
        </div>
      ) : null}
    </div>
  );
}
