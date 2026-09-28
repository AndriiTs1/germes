/*
 * The small subset of the Prisma client the apply / verify phase uses. The
 * real PrismaClient satisfies it at runtime; tests supply an in-memory fake.
 * Type-only module — importing it never loads Prisma or opens a connection.
 */

export type Row = Record<string, unknown>;

export type Delegate = {
  findMany(args?: { where?: Row; select?: Row }): Promise<Row[]>;
  count(args?: { where?: Row }): Promise<number>;
  createMany(args: { data: Row[] }): Promise<{ count: number }>;
  update(args: { where: Row; data: Row }): Promise<Row>;
};

export type DemoDbTx = {
  customer: Delegate;
  supplier: Delegate;
  product: Delegate;
  warehouse: Delegate;
  user: Delegate;
  salesOrder: Delegate;
  salesOrderItem: Delegate;
  batch: Delegate;
  stockMovement: Delegate;
  stockReservation: Delegate;
  receivable: Delegate;
  payable: Delegate;
  purchaseOrder: Delegate;
  purchaseOrderItem: Delegate;
  auditLog: Delegate;
  /** Used only to mark read-only transactions (SET TRANSACTION READ ONLY). */
  $executeRawUnsafe(sql: string): Promise<unknown>;
};

export type DemoDb = DemoDbTx & {
  $transaction<T>(fn: (tx: DemoDbTx) => Promise<T>, options?: { maxWait?: number; timeout?: number }): Promise<T>;
};
