/**
 * In-memory stand-in for the Prisma calls the procurement services make.
 * It stores state and evaluates the `where` shapes those services use, so
 * tests exercise the real service code with no database. `beforeWrite`
 * lets a test change state between a service's read and its guarded write,
 * simulating a concurrent request.
 */
type Decimalish = { toString(): string };

export type FakeItem = { productId: string; quantityKg: Decimalish; pricePerKg: Decimalish | null };

export type FakeOrder = {
  id: string;
  orderNumber: string;
  status: "DRAFT" | "CONFIRMED" | "CLOSED" | "CANCELLED";
  supplierId: string;
  destinationWarehouseId: string | null;
  createdById: string;
  currency: string;
  orderDate: Date | null;
  expectedArrivalDate: Date | null;
  notes: string | null;
  updatedAt: Date;
  items: FakeItem[];
};

export type FakeState = {
  orders: FakeOrder[];
  suppliers: { id: string; isActive: boolean; status: string }[];
  warehouses: { id: string; isActive: boolean }[];
  products: { id: string; isActive: boolean }[];
  audit: { actorId: string; entityType: string; entityId: string; action: string; metadata: unknown }[];
  transactionOptions: unknown[];
  beforeWrite?: () => void;
};

type Where = Record<string, unknown>;

function matchesOrder(order: FakeOrder, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (order as Record<string, unknown>)[key];
    if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
    return actual === expected;
  });
}

function matchesRow(row: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === "object" && "in" in expected) {
      return (expected as { in: unknown[] }).in.includes(actual);
    }
    return actual === expected;
  });
}

export function createFakePrisma(state: FakeState) {
  const tx = {
    purchaseOrder: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const order = state.orders.find((o) => o.id === where.id);
        return order ? { ...order, items: order.items.map((item) => ({ ...item })) } : null;
      },
      findFirst: async ({ where }: { where: Where }) => {
        const order = state.orders.find((o) => matchesOrder(o, where));
        return order ? { id: order.id } : null;
      },
      findMany: async ({ where }: { where: { orderNumber: { startsWith: string } } }) =>
        state.orders
          .filter((o) => o.orderNumber.startsWith(where.orderNumber.startsWith))
          .map((o) => ({ orderNumber: o.orderNumber })),
      updateMany: async ({ where, data }: { where: Where; data: Partial<FakeOrder> }) => {
        state.beforeWrite?.();
        const matched = state.orders.filter((o) => matchesOrder(o, where));
        for (const order of matched) {
          Object.assign(order, data, { updatedAt: new Date(order.updatedAt.getTime() + 1000) });
        }
        return { count: matched.length };
      },
      create: async ({ data }: { data: Omit<FakeOrder, "id" | "updatedAt" | "items"> }) => {
        const order: FakeOrder = {
          ...data,
          id: `po-${state.orders.length + 1}`,
          updatedAt: new Date("2026-09-27T10:00:00Z"),
          items: [],
        };
        state.orders.push(order);
        return order;
      },
    },
    purchaseOrderItem: {
      deleteMany: async ({ where }: { where: { purchaseOrderId: string } }) => {
        const order = state.orders.find((o) => o.id === where.purchaseOrderId);
        const count = order?.items.length ?? 0;
        if (order) order.items = [];
        return { count };
      },
      createMany: async ({ data }: { data: (FakeItem & { purchaseOrderId: string })[] }) => {
        for (const { purchaseOrderId, ...item } of data) {
          state.orders.find((o) => o.id === purchaseOrderId)?.items.push(item);
        }
        return { count: data.length };
      },
    },
    supplier: {
      findFirst: async ({ where }: { where: Where }) =>
        state.suppliers.find((s) => matchesRow(s, where)) ? { id: where.id } : null,
    },
    warehouse: {
      findFirst: async ({ where }: { where: Where }) =>
        state.warehouses.find((w) => matchesRow(w, where)) ? { id: where.id } : null,
    },
    product: {
      findMany: async ({ where }: { where: Where }) =>
        state.products.filter((p) => matchesRow(p, where)).map((p) => ({ id: p.id })),
    },
    auditLog: {
      create: async ({ data }: { data: FakeState["audit"][number] }) => {
        state.audit.push(data);
        return data;
      },
    },
  };

  return {
    ...tx,
    // Writes inside a callback are not rolled back here; tests assert on
    // results and on the state a successful or rejected call leaves.
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>, options?: unknown) => {
      state.transactionOptions.push(options);
      return callback(tx);
    },
  };
}

export const SUPPLIER_ID = "11111111-1111-4111-8111-111111111111";
export const WAREHOUSE_ID = "22222222-2222-4222-8222-222222222222";
export const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
export const PRODUCT_B = "44444444-4444-4444-8444-444444444444";

export function baseState(): FakeState {
  return {
    orders: [],
    suppliers: [{ id: SUPPLIER_ID, isActive: true, status: "ACTIVE" }],
    warehouses: [{ id: WAREHOUSE_ID, isActive: true }],
    products: [
      { id: PRODUCT_A, isActive: true },
      { id: PRODUCT_B, isActive: true },
    ],
    audit: [],
    transactionOptions: [],
  };
}

export function makeOrder(overrides: Partial<FakeOrder> = {}): FakeOrder {
  return {
    id: "po-1",
    orderNumber: "PO-2026-001",
    status: "DRAFT",
    supplierId: SUPPLIER_ID,
    destinationWarehouseId: WAREHOUSE_ID,
    createdById: "creator-1",
    currency: "UAH",
    orderDate: null,
    expectedArrivalDate: null,
    notes: null,
    updatedAt: new Date("2026-09-27T09:00:00.000Z"),
    items: [{ productId: PRODUCT_A, quantityKg: { toString: () => "1000" }, pricePerKg: { toString: () => "160" } }],
    ...overrides,
  };
}
