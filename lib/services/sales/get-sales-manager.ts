import { prisma } from "@/lib/db/prisma";

export type SalesManager = {
  id: string;
  name: string | null;
  email: string;
};

/**
 * One active SALES user by id, or null. Used by the supervisory customers/
 * orders pages to label the ?manager= filter and to reject an id that is
 * not a real sales manager. No auth/permission logic — the caller decides
 * whether a manager filter applies at all (see resolveResponsibleFilter).
 */
export async function getSalesManager(id: string): Promise<SalesManager | null> {
  return prisma.user.findFirst({
    where: { id, isActive: true, roles: { some: { role: { code: "SALES" } } } },
    select: { id: true, name: true, email: true },
  });
}
