import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type InventoryStatusData = {
  value: string;
  segments: {
    key: "inStock" | "reserved" | "inTransit" | "lowStock";
    pct: number;
    accent: "mint" | "blue" | "amber" | "rose";
  }[];
};

export async function getInventoryStatus(): Promise<InventoryStatusData> {
  const movements = await prisma.stockMovement.findMany({
    select: {
      type: true,
      quantityKg: true,
    },
  });

  const reservations = await prisma.stockReservation.findMany({
    where: {
      status: "ACTIVE",
    },
    select: {
      quantityKg: true,
    },
  });

  let totalKg = new Prisma.Decimal(0);
  let reservedKg = new Prisma.Decimal(0);

  for (const movement of movements) {
    if (
      movement.type === "RECEIPT" ||
      movement.type === "TRANSFER"
    ) {
      totalKg = totalKg.plus(movement.quantityKg);
    }

    if (
      movement.type === "SHIPMENT" ||
      movement.type === "WRITE_OFF"
    ) {
      totalKg = totalKg.minus(movement.quantityKg);
    }
  }

  for (const reservation of reservations) {
    reservedKg = reservedKg.plus(reservation.quantityKg);
  }

  const availableKg = totalKg.minus(reservedKg);

  const total = Number(totalKg.toString()) || 1;

  return {
    value: Math.round(Number(totalKg.toString())).toString(),
    segments: [
      {
        key: "inStock",
        pct: Math.round((Number(availableKg.toString()) / total) * 100),
        accent: "mint",
      },
      {
        key: "reserved",
        pct: Math.round((Number(reservedKg.toString()) / total) * 100),
        accent: "blue",
      },
      {
        key: "inTransit",
        pct: 0,
        accent: "amber",
      },
      {
        key: "lowStock",
        pct: 0,
        accent: "rose",
      },
    ],
  };
}
