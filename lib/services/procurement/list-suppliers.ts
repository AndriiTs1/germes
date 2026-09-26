import { Prisma, SupplierStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export const SUPPLIER_PAGE_SIZE = 20;

/**
 * URL/filter sentinel for "country not specified" (null or empty string).
 * Never a real country value — real values come from the Supplier data.
 */
export const SUPPLIER_COUNTRY_NONE = "__none__";

export type SupplierListItem = {
  id: string;
  code: string;
  name: string;
  country: string | null;
  status: SupplierStatus;
};

export type ListSuppliersOptions = {
  /** Case-insensitive match on name or code. Trimmed; empty = no search filter. */
  search?: string;
  /** Exact SupplierStatus. Omitted = all statuses. */
  status?: SupplierStatus;
  /** Exact stored country value, or SUPPLIER_COUNTRY_NONE. Omitted = all countries. */
  country?: string;
  /** 1-indexed page. Invalid/missing = 1. */
  page?: number;
  limit?: number;
};

export type ListSuppliersResult = {
  items: SupplierListItem[];
  /** Suppliers matching the current search/filters. */
  totalCount: number;
  /** All Supplier records — distinguishes "no suppliers at all" from "no matches". */
  allCount: number;
  page: number;
  pageCount: number;
};

/**
 * Read-only, server-side Supplier list for /procurement. No auth/permission
 * logic — the page decides who may call this (suppliers.read). Includes
 * every Supplier record (no isActive filter), matching the "all suppliers"
 * KPI. Stored country values are matched exactly, never normalized.
 */
export async function listSuppliers(options: ListSuppliersOptions = {}): Promise<ListSuppliersResult> {
  const { status, country, limit = SUPPLIER_PAGE_SIZE } = options;
  const search = options.search?.trim();
  const page = options.page && Number.isFinite(options.page) && options.page > 0 ? Math.floor(options.page) : 1;

  const where: Prisma.SupplierWhereInput = {
    status,
    AND: [
      search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
      country === SUPPLIER_COUNTRY_NONE
        ? { OR: [{ country: null }, { country: "" }] }
        : country
          ? { country }
          : {},
    ],
  };

  const [items, totalCount, allCount] = await Promise.all([
    prisma.supplier.findMany({
      where,
      select: { id: true, code: true, name: true, country: true, status: true },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.supplier.count({ where }),
    prisma.supplier.count(),
  ]);

  return {
    items,
    totalCount,
    allCount,
    page,
    pageCount: Math.max(1, Math.ceil(totalCount / limit)),
  };
}

/** Distinct non-empty country values as stored on Supplier records (unsorted). */
export async function listSupplierCountries(): Promise<string[]> {
  const rows = await prisma.supplier.findMany({
    where: { country: { not: null }, NOT: { country: "" } },
    distinct: ["country"],
    select: { country: true },
  });
  return rows.map((row) => row.country).filter((value): value is string => Boolean(value));
}
