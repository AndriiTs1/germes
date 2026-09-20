import { SupportTicketStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type AddSupportMessageResult =
  | {
      ok: true;
      messageId: string;
    }
  | {
      ok: false;
      error: "TICKET_UNAVAILABLE" | "TICKET_CLOSED" | "CREATE_FAILED";
    };

/**
 * Adds one customer message to a support ticket owned by the supplied user.
 *
 * Ownership and CLOSED-state protection are re-asserted by the actual UPDATE
 * inside the transaction, so a concurrent close cannot race past an earlier
 * read. A customer reply to a RESOLVED ticket reopens it as IN_PROGRESS.
 */
export async function addSupportMessage(
  currentUserId: string,
  ticketId: string,
  body: string,
): Promise<AddSupportMessageResult> {
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findFirst({
        where: {
          id: ticketId,
          createdById: currentUserId,
        },
        select: {
          id: true,
          number: true,
          status: true,
        },
      });

      if (!ticket) {
        return {
          ok: false as const,
          error: "TICKET_UNAVAILABLE" as const,
        };
      }

      if (ticket.status === SupportTicketStatus.CLOSED) {
        return {
          ok: false as const,
          error: "TICKET_CLOSED" as const,
        };
      }

      const updateResult = await tx.supportTicket.updateMany({
        where: {
          id: ticket.id,
          createdById: currentUserId,
          status: {
            not: SupportTicketStatus.CLOSED,
          },
        },
        data: {
          lastMessageAt: now,
          status:
            ticket.status === SupportTicketStatus.RESOLVED
              ? SupportTicketStatus.IN_PROGRESS
              : undefined,
          resolvedAt:
            ticket.status === SupportTicketStatus.RESOLVED
              ? null
              : undefined,
        },
      });

      if (updateResult.count !== 1) {
        const stillOwned = await tx.supportTicket.findFirst({
          where: {
            id: ticket.id,
            createdById: currentUserId,
          },
          select: {
            status: true,
          },
        });

        return {
          ok: false as const,
          error:
            stillOwned?.status === SupportTicketStatus.CLOSED
              ? ("TICKET_CLOSED" as const)
              : ("TICKET_UNAVAILABLE" as const),
        };
      }

      const message = await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: currentUserId,
          body,
          createdAt: now,
        },
        select: {
          id: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUserId,
          entityType: "SupportTicket",
          entityId: ticket.id,
          action: "MESSAGE_ADD",
          metadata: {
            number: ticket.number,
            reopened:
              ticket.status === SupportTicketStatus.RESOLVED,
          },
        },
      });

      return {
        ok: true as const,
        messageId: message.id,
      };
    });
  } catch {
    return {
      ok: false,
      error: "CREATE_FAILED",
    };
  }
}
