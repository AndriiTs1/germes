import { prisma } from "@/lib/db/prisma";

export async function listSupportAgents() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          role: {
            code: "SUPPORT",
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: [
      { name: "asc" },
      { email: "asc" },
    ],
  });
}
