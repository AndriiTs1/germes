import { prisma } from "@/lib/db/prisma";

export type SalesOrderHistoryItem = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  metadata: unknown;
  createdAt: string;
};

export async function getSalesOrderHistory(
  salesOrderId: string,
): Promise<SalesOrderHistoryItem[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        {
          entityType: "SalesOrder",
          entityId: salesOrderId,
        },
        {
          entityType: "StockReservation",
          metadata: {
            path: ["salesOrderId"],
            equals: salesOrderId,
          },
        },
        {
          entityType: "Receivable",
          metadata: {
            path: ["salesOrderId"],
            equals: salesOrderId,
          },
        },
      ],
    },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      action: true,
      metadata: true,
      createdAt: true,
      actor: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return logs.map((log) => ({
    id: log.id,
    entityType: log.entityType,
    entityId: log.entityId,
    action: log.action,
    actorName: log.actor?.name ?? null,
    actorEmail: log.actor?.email ?? null,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  }));
}
