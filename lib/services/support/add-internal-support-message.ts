import { SupportTicketStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type AddInternalSupportMessageResult =
  | {
      ok: true;
      messageId: string;
    }
  | {
      ok: false;
      error: "TICKET_UNAVAILABLE" | "TICKET_CLOSED" | "CREATE_FAILED";
    };

export async function addInternalSupportMessage(
  currentUserId: string,
  ticketId: string,
  body: string,
): Promise<AddInternalSupportMessageResult> {
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({
        where: {
          id: ticketId,
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
          status: {
            not: SupportTicketStatus.CLOSED,
          },
        },
        data: {
          lastMessageAt: now,
          status:
            ticket.status === SupportTicketStatus.NEW
              ? SupportTicketStatus.IN_PROGRESS
              : undefined,
        },
      });

      if (updateResult.count !== 1) {
        const current = await tx.supportTicket.findUnique({
          where: {
            id: ticket.id,
          },
          select: {
            status: true,
          },
        });

        return {
          ok: false as const,
          error:
            current?.status === SupportTicketStatus.CLOSED
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
          action: "SUPPORT_MESSAGE_ADD",
          metadata: {
            number: ticket.number,
            previousStatus: ticket.status,
            autoStarted:
              ticket.status === SupportTicketStatus.NEW,
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
