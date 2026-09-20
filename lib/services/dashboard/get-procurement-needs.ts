import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ProcurementNeedsData = {
  value: string;
  items: {
    name: string;
    stockKg: number;
    urgency: "critical" | "warning";
  }[];
};

export async function getProcurementNeeds(): Promise<ProcurementNeedsData> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    select: {
      name: true,
      batches: {
        select: {
          id: true,
          stockMovements: {
            select: {
              type: true,
              quantityKg: true,
            },
          },
        },
      },
    },
  });

  const items: {
    name: string;
    stockKg: number;
    urgency: "critical" | "warning";
  }[] = [];

  for (const product of products) {
    let stock = new Prisma.Decimal(0);

    for (const batch of product.batches) {
      for (const movement of batch.stockMovements) {
        if (
          movement.type === "RECEIPT" ||
          movement.type === "TRANSFER"
        ) {
          stock = stock.plus(movement.quantityKg);
        }

        if (
          movement.type === "SHIPMENT" ||
          movement.type === "WRITE_OFF"
        ) {
          stock = stock.minus(movement.quantityKg);
        }
      }
    }

    const stockKg = Math.round(Number(stock.toString()));

    items.push({
      name: product.name,
      stockKg,
      urgency: stockKg === 0 ? "critical" : "warning",
    });
  }

  items.sort((a, b) => a.stockKg - b.stockKg);

  const limitedItems = items.slice(0, 3);

  return {
    value: limitedItems.length.toString(),
    items: limitedItems,
  };
}
