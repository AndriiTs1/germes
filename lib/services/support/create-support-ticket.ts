import type { SupportTicketCategory } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CreateSupportTicketInput = {
  subject: string;
  category: SupportTicketCategory;
  body: string;
};

export type CreateSupportTicketResult =
  | {
      ok: true;
      ticketId: string;
      ticketNumber: number;
    }
  | {
      ok: false;
      error: "CREATE_FAILED";
    };

/**
 * Creates a support ticket, its initial customer message and the corresponding
 * audit record atomically.
 *
 * Authentication is intentionally outside this service. The caller must
 * resolve the current active Germes user and pass only that trusted user.id.
 * No createdById, authorId, status, priority or assignment value is accepted
 * from client input.
 */
export async function createSupportTicket(
  currentUserId: string,
  input: CreateSupportTicketInput,
): Promise<CreateSupportTicketResult> {
  const now = new Date();

  try {
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          subject: input.subject,
          category: input.category,
          createdById: currentUserId,
          lastMessageAt: now,
        },
        select: {
          id: true,
          number: true,
          category: true,
        },
      });

      await tx.supportMessage.create({
        data: {
          ticketId: created.id,
          authorId: currentUserId,
          body: input.body,
          createdAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUserId,
          entityType: "SupportTicket",
          entityId: created.id,
          action: "CREATE",
          metadata: {
            number: created.number,
            category: created.category,
          },
        },
      });

      return created;
    });

    return {
      ok: true,
      ticketId: ticket.id,
      ticketNumber: ticket.number,
    };
  } catch {
    return {
      ok: false,
      error: "CREATE_FAILED",
    };
  }
}
