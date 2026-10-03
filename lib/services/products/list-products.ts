import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Large enough to show the whole current catalog on one page, small enough to stay a bounded query. */
export const PRODUCT_PAGE_SIZE = 50;

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  isActive: boolean;
};

export type ListProductsOptions = {
  /** Case-insensitive match on SKU or name. Trimmed; empty = no search filter. */
  search?: string;
  /** Exact stored category value. Omitted = all categories. */
  category?: string;
  /** true = active only, false = inactive only, omitted = every Product. */
  isActive?: boolean;
  /** 1-indexed page. Invalid/missing = 1. */
  page?: number;
  limit?: number;
};

export type ListProductsResult = {
  items: ProductListItem[];
  /** Products matching the current search/filters. */
  totalCount: number;
  /** All Product records — distinguishes "no products at all" from "no matches". */
  allCount: number;
  page: number;
  pageCount: number;
};

/**
 * Read-only, server-side Product master catalog for /products. No
 * auth/permission logic — the page decides who may call this
 * (products.read). Every Product record is a candidate regardless of stock:
 * a product with zero (or no) stock movements is still listed. Ordered by
 * SKU, which is unique, so skip/take pages never overlap or drop rows.
 */
export async function listProducts(options: ListProductsOptions = {}): Promise<ListProductsResult> {
  const { category, isActive, limit = PRODUCT_PAGE_SIZE } = options;
  const search = options.search?.trim();
  const page = options.page && Number.isFinite(options.page) && options.page > 0 ? Math.floor(options.page) : 1;

  const where: Prisma.ProductWhereInput = {
    isActive,
    category,
    ...(search
      ? {
          OR: [
            { sku: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, totalCount, allCount] = await Promise.all([
    prisma.product.findMany({
      where,
      select: { id: true, sku: true, name: true, category: true, isActive: true },
      orderBy: { sku: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
    prisma.product.count(),
  ]);

  return {
    items,
    totalCount,
    allCount,
    page,
    pageCount: Math.max(1, Math.ceil(totalCount / limit)),
  };
}

/** Distinct non-empty category values as stored on Product records (unsorted). */
export async function listProductCategories(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { category: { not: null }, NOT: { category: "" } },
    distinct: ["category"],
    select: { category: true },
  });
  return rows.map((row) => row.category).filter((value): value is string => Boolean(value));
}
