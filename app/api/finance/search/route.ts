import { NextResponse } from "next/server";

import {
  FinanceStatus,
  Prisma,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { openOutstanding } from "@/lib/services/finance/outstanding";
import {
  customerResultHref,
  orderResultHref,
  supplierResultHref,
  type SearchLinkViewer,
} from "@/lib/services/finance/search-result-links";
import { resolveSalesReadScope } from "@/lib/services/sales/read-scope";

const CLOSED = [
  FinanceStatus.PAID,
  FinanceStatus.CANCELLED,
];

const SEARCH_LIMIT = 4;

type MoneyLine = {
  currency: string;
  outstandingAmount: string;
  overdueAmount: string;
};

function add(
  map: Map<string, Prisma.Decimal>,
  currency: string,
  amount: Prisma.Decimal,
) {
  map.set(
    currency,
    (map.get(currency) ?? new Prisma.Decimal(0)).plus(amount),
  );
}

function moneyLines(
  outstanding: Map<string, Prisma.Decimal>,
  overdue: Map<string, Prisma.Decimal>,
): MoneyLine[] {
  return [...outstanding.entries()]
    .sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
    .map(([currency, amount]) => ({
      currency,
      outstandingAmount: amount.toString(),
      overdueAmount:
        overdue.get(currency)?.toString() ?? "0",
    }));
}

export async function GET(request: Request) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    user = await requirePermission("finance.dashboard.read");
  } catch {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403 },
    );
  }

  // Results are shown to every finance.dashboard.read holder, but each one
  // links only where this viewer can open the target page (see
  // search-result-links.ts) — ACCOUNTING/ADMIN never get links that would
  // end in notFound() or redirect("/").
  const viewer: SearchLinkViewer = {
    userId: user.id,
    readScope: resolveSalesReadScope(user.roles.map((entry) => entry.role.code)),
    permissionCodes: await getPermissionCodesForUser(user.id),
  };

  const url = new URL(request.url);
  const query =
    url.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({
      customers: [],
      suppliers: [],
      orders: [],
    });
  }

  const now = new Date();

  const [customers, suppliers, orders] =
    await Promise.all([
      prisma.customer.findMany({
        where: {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          responsibleId: true,
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
        take: SEARCH_LIMIT,
      }),

      prisma.supplier.findMany({
        where: {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
        take: SEARCH_LIMIT,
      }),

      prisma.salesOrder.findMany({
        where: {
          orderNumber: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          orderNumber: true,
          responsibleId: true,
          customer: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          orderNumber: "asc",
        },
        take: SEARCH_LIMIT,
      }),
    ]);

  const [
    customerReceivables,
    supplierPayables,
    orderReceivables,
  ] = await Promise.all([
    customers.length
      ? prisma.receivable.findMany({
          where: {
            customerId: {
              in: customers.map(
                (customer) => customer.id,
              ),
            },
            status: {
              notIn: CLOSED,
            },
          },
          select: {
            customerId: true,
            amount: true,
            paidAmount: true,
            currency: true,
            dueDate: true,
            status: true,
          },
        })
      : Promise.resolve([]),

    suppliers.length
      ? prisma.payable.findMany({
          where: {
            supplierId: {
              in: suppliers.map(
                (supplier) => supplier.id,
              ),
            },
            status: {
              notIn: CLOSED,
            },
          },
          select: {
            supplierId: true,
            amount: true,
            paidAmount: true,
            currency: true,
            dueDate: true,
            status: true,
          },
        })
      : Promise.resolve([]),

    orders.length
      ? prisma.receivable.findMany({
          where: {
            salesOrderId: {
              in: orders.map((order) => order.id),
            },
            status: {
              notIn: CLOSED,
            },
          },
          select: {
            salesOrderId: true,
            amount: true,
            paidAmount: true,
            currency: true,
            dueDate: true,
            status: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const customerMaps = new Map<
    string,
    {
      outstanding: Map<string, Prisma.Decimal>;
      overdue: Map<string, Prisma.Decimal>;
    }
  >();

  for (const row of customerReceivables) {
    const outstanding = openOutstanding(row);

    if (!outstanding) continue;

    const bucket =
      customerMaps.get(row.customerId) ?? {
        outstanding: new Map(),
        overdue: new Map(),
      };

    add(
      bucket.outstanding,
      row.currency,
      outstanding,
    );

    if (
      row.dueDate &&
      row.dueDate.getTime() < now.getTime()
    ) {
      add(
        bucket.overdue,
        row.currency,
        outstanding,
      );
    }

    customerMaps.set(row.customerId, bucket);
  }

  const supplierMaps = new Map<
    string,
    {
      outstanding: Map<string, Prisma.Decimal>;
      overdue: Map<string, Prisma.Decimal>;
    }
  >();

  for (const row of supplierPayables) {
    const outstanding = openOutstanding(row);

    if (!outstanding) continue;

    const bucket =
      supplierMaps.get(row.supplierId) ?? {
        outstanding: new Map(),
        overdue: new Map(),
      };

    add(
      bucket.outstanding,
      row.currency,
      outstanding,
    );

    if (
      row.dueDate &&
      row.dueDate.getTime() < now.getTime()
    ) {
      add(
        bucket.overdue,
        row.currency,
        outstanding,
      );
    }

    supplierMaps.set(row.supplierId, bucket);
  }

  const orderMaps = new Map<
    string,
    {
      outstanding: Map<string, Prisma.Decimal>;
      overdue: Map<string, Prisma.Decimal>;
      dueDate: Date | null;
    }
  >();

  for (const row of orderReceivables) {
    if (!row.salesOrderId) continue;

    const outstanding = openOutstanding(row);

    if (!outstanding) continue;

    const bucket =
      orderMaps.get(row.salesOrderId) ?? {
        outstanding: new Map(),
        overdue: new Map(),
        dueDate: null,
      };

    add(
      bucket.outstanding,
      row.currency,
      outstanding,
    );

    if (
      row.dueDate &&
      row.dueDate.getTime() < now.getTime()
    ) {
      add(
        bucket.overdue,
        row.currency,
        outstanding,
      );
    }

    if (
      row.dueDate &&
      (
        bucket.dueDate === null ||
        row.dueDate < bucket.dueDate
      )
    ) {
      bucket.dueDate = row.dueDate;
    }

    orderMaps.set(row.salesOrderId, bucket);
  }

  return NextResponse.json({
    customers: customers.map((customer) => {
      const bucket =
        customerMaps.get(customer.id);

      return {
        id: customer.id,
        name: customer.name,
        href: customerResultHref(viewer, customer),
        balances: bucket
          ? moneyLines(
              bucket.outstanding,
              bucket.overdue,
            )
          : [],
      };
    }),

    suppliers: suppliers.map((supplier) => {
      const bucket =
        supplierMaps.get(supplier.id);

      return {
        id: supplier.id,
        name: supplier.name,
        href: supplierResultHref(viewer, supplier),
        balances: bucket
          ? moneyLines(
              bucket.outstanding,
              bucket.overdue,
            )
          : [],
      };
    }),

    orders: orders.map((order) => {
      const bucket = orderMaps.get(order.id);

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        href: orderResultHref(viewer, order),
        dueDate:
          bucket?.dueDate?.toISOString() ?? null,
        balances: bucket
          ? moneyLines(
              bucket.outstanding,
              bucket.overdue,
            )
          : [],
      };
    }),
  });
}
