import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Minimal in-memory Prisma stand-in for the Product catalog and every stock
 * read service (Sales, Warehouse, Command Center, Products). Implements only
 * the query shapes those services actually use, so one fixture can be run
 * through all of them and compared.
 */
export type FakeProduct = { id: string; sku: string; name: string; category: string | null; isActive: boolean };
export type FakeBatch = { id: string; productId: string; status: string };
export type FakeMovement = {
  id: string;
  type: string;
  batchId: string;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  quantityKg: Prisma.Decimal;
};
export type FakeReservation = {
  productId: string;
  batchId: string | null;
  warehouseId: string | null;
  quantityKg: Prisma.Decimal;
  status: string;
  expiresAt: Date | null;
  orderStatus: string;
};

export type FakeStockDb = {
  products: FakeProduct[];
  warehouses: { id: string; code: string; name: string; isActive: boolean }[];
  batches: FakeBatch[];
  movements: FakeMovement[];
  reservations: FakeReservation[];
  calls: string[];
};

export function emptyFakeStockDb(): FakeStockDb {
  return { products: [], warehouses: [], batches: [], movements: [], reservations: [], calls: [] };
}

type Where = Record<string, unknown>;

const inList = (cond: unknown, value: unknown) =>
  cond === undefined || (typeof cond === "object" && cond !== null && "in" in cond
    ? (cond as { in: unknown[] }).in.includes(value)
    : cond === value);

function contains(cond: unknown, value: string | null) {
  const c = cond as { contains: string; mode?: string };
  return value !== null && value.toLowerCase().includes(c.contains.toLowerCase());
}

function productMatches(p: FakeProduct, where: Where = {}): boolean {
  if (where.isActive !== undefined && p.isActive !== where.isActive) return false;
  if (where.category !== undefined) {
    const c = where.category;
    if (typeof c === "string" && p.category !== c) return false;
    if (typeof c === "object" && c !== null && "not" in c && p.category === (c as { not: unknown }).not) return false;
  }
  if (where.NOT && p.category === (where.NOT as { category: string }).category) return false;
  if (where.OR) {
    const ok = (where.OR as Where[]).some((clause) =>
      Object.entries(clause).every(([key, cond]) => contains(cond, (p as Record<string, unknown>)[key] as string)),
    );
    if (!ok) return false;
  }
  return true;
}

function reservationMatches(r: FakeReservation, where: Where = {}): boolean {
  if (where.status !== undefined && r.status !== where.status) return false;
  if (!inList(where.productId, r.productId)) return false;
  if (where.OR) {
    const ok = (where.OR as Where[]).some((clause) => {
      if ("salesOrder" in clause) {
        return (clause.salesOrder as { status: { in: string[] } }).status.in.includes(r.orderStatus);
      }
      if (clause.expiresAt === null) return r.expiresAt === null;
      const gt = (clause.expiresAt as { gt: Date }).gt;
      return r.expiresAt !== null && r.expiresAt > gt;
    });
    if (!ok) return false;
  }
  return true;
}

function sortProducts(rows: FakeProduct[], orderBy: unknown) {
  const clauses = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []) as Record<string, "asc" | "desc">[];
  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      const [key, dir] = Object.entries(clause)[0] as [keyof FakeProduct, "asc" | "desc"];
      const av = String(a[key]);
      const bv = String(b[key]);
      if (av !== bv) return (av < bv ? -1 : 1) * (dir === "asc" ? 1 : -1);
    }
    return 0;
  });
}

export function createFakePrisma(db: FakeStockDb) {
  const batchOf = (id: string) => db.batches.find((b) => b.id === id)!;
  const warehouseOf = (id: string | null) => (id ? db.warehouses.find((w) => w.id === id) ?? null : null);

  return {
    product: {
      findMany: async (args: { where?: Where; orderBy?: unknown; skip?: number; take?: number; distinct?: string[]; select?: Where } = {}) => {
        db.calls.push("product.findMany");
        let rows = sortProducts(db.products.filter((p) => productMatches(p, args.where)), args.orderBy);
        if (args.distinct) {
          const seen = new Set<unknown>();
          rows = rows.filter((p) => {
            const key = (p as Record<string, unknown>)[args.distinct![0]];
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
        if (args.skip) rows = rows.slice(args.skip);
        if (args.take !== undefined) rows = rows.slice(0, args.take);
        // getProcurementNeeds selects products with nested batches → stockMovements.
        if (args.select && "batches" in args.select) {
          return rows.map((p) => ({
            ...p,
            batches: db.batches
              .filter((b) => b.productId === p.id)
              .map((b) => ({ id: b.id, stockMovements: db.movements.filter((mv) => mv.batchId === b.id) })),
          }));
        }
        return rows.map((p) => ({ ...p }));
      },
      count: async (args: { where?: Where } = {}) => {
        db.calls.push("product.count");
        return db.products.filter((p) => productMatches(p, args.where)).length;
      },
    },
    warehouse: {
      findMany: async () => db.warehouses.filter((w) => w.isActive).sort((a, b) => a.code.localeCompare(b.code)),
    },
    batch: {
      findMany: async (args: { where?: Where } = {}) => {
        db.calls.push("batch.findMany");
        return db.batches.filter((b) => inList(args.where?.productId, b.productId)).map((b) => ({ ...b }));
      },
    },
    stockMovement: {
      findMany: async () => {
        db.calls.push("stockMovement.findMany");
        return db.movements.map((mv) => {
          const batch = batchOf(mv.batchId);
          return {
            ...mv,
            batch: { productId: batch.productId, status: batch.status, batchNumber: batch.id, product: db.products.find((p) => p.id === batch.productId) },
            fromWarehouse: warehouseOf(mv.fromWarehouseId),
            toWarehouse: warehouseOf(mv.toWarehouseId),
          };
        });
      },
      groupBy: async (args: { by: string[]; where?: Where }) => {
        db.calls.push("stockMovement.groupBy");
        const groups = new Map<string, { batchId: string; fromWarehouseId: string | null; toWarehouseId: string | null; _sum: { quantityKg: Prisma.Decimal } }>();
        for (const mv of db.movements.filter((row) => inList(args.where?.batchId, row.batchId))) {
          const key = `${mv.batchId}|${mv.fromWarehouseId}|${mv.toWarehouseId}`;
          const group = groups.get(key) ?? { batchId: mv.batchId, fromWarehouseId: mv.fromWarehouseId, toWarehouseId: mv.toWarehouseId, _sum: { quantityKg: new Prisma.Decimal(0) } };
          group._sum.quantityKg = group._sum.quantityKg.plus(mv.quantityKg);
          groups.set(key, group);
        }
        return [...groups.values()];
      },
    },
    stockReservation: {
      findMany: async (args: { where?: Where } = {}) => {
        db.calls.push("stockReservation.findMany");
        return db.reservations
          .filter((r) => reservationMatches(r, args.where))
          .map((r) => ({ ...r, batch: r.batchId ? { status: batchOf(r.batchId).status } : null }));
      },
    },
  };
}
