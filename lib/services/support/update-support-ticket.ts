import {
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type UpdateSupportTicketInput = {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedToId?: string | null;
};

export type UpdateSupportTicketResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error:
        | "TICKET_UNAVAILABLE"
        | "INVALID_ASSIGNEE"
        | "UPDATE_FAILED";
    };

export async function updateSupportTicket(
  currentUserId: string,
  ticketId: string,
  input: UpdateSupportTicketInput,
): Promise<UpdateSupportTicketResult> {
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
          priority: true,
          assignedToId: true,
        },
      });

      if (!ticket) {
        return {
          ok: false as const,
          error: "TICKET_UNAVAILABLE" as const,
        };
      }

      if (input.assignedToId !== undefined && input.assignedToId !== null) {
        const assignee = await tx.user.findFirst({
          where: {
            id: input.assignedToId,
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
          },
        });

        if (!assignee) {
          return {
            ok: false as const,
            error: "INVALID_ASSIGNEE" as const,
          };
        }
      }

      const nextStatus = input.status ?? ticket.status;

      await tx.supportTicket.update({
        where: {
          id: ticket.id,
        },
        data: {
          status: input.status,
          priority: input.priority,
          assignedToId: input.assignedToId,

          resolvedAt:
            input.status === undefined
              ? undefined
              : nextStatus === SupportTicketStatus.RESOLVED
                ? now
                : nextStatus === SupportTicketStatus.CLOSED
                  ? ticket.status === SupportTicketStatus.RESOLVED
                    ? undefined
                    : null
                  : null,

          closedAt:
            input.status === undefined
              ? undefined
              : nextStatus === SupportTicketStatus.CLOSED
                ? now
                : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUserId,
          entityType: "SupportTicket",
          entityId: ticket.id,
          action: "SUPPORT_UPDATE",
          metadata: {
            number: ticket.number,
            previousStatus: ticket.status,
            nextStatus: input.status ?? ticket.status,
            previousPriority: ticket.priority,
            nextPriority: input.priority ?? ticket.priority,
            previousAssignedToId: ticket.assignedToId,
            nextAssignedToId:
              input.assignedToId === undefined
                ? ticket.assignedToId
                : input.assignedToId,
          },
        },
      });

      return {
        ok: true as const,
      };
    });
  } catch {
    return {
      ok: false,
      error: "UPDATE_FAILED",
    };
  }
}
