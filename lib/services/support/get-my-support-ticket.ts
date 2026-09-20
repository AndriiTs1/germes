import { prisma } from "@/lib/db/prisma";

export type MySupportTicketMessage = {
  id: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
  body: string;
  createdAt: string;
};

export type MySupportTicketDetail = {
  id: string;
  number: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  messages: MySupportTicketMessage[];
};

/**
 * Returns one support ticket owned by exactly the supplied Germes user.
 *
 * id + createdById are checked together in the same query. A missing ticket
 * and a ticket owned by another user are intentionally indistinguishable:
 * both return null and no existence information is leaked.
 */
export async function getMySupportTicket(
  currentUserId: string,
  ticketId: string,
): Promise<MySupportTicketDetail | null> {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      createdById: currentUserId,
    },
    select: {
      id: true,
      number: true,
      subject: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
      resolvedAt: true,
      closedAt: true,
      messages: {
        select: {
          id: true,
          authorId: true,
          body: true,
          createdAt: true,
          author: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      },
    },
  });

  if (!ticket) {
    return null;
  }

  return {
    id: ticket.id,
    number: ticket.number,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    messages: ticket.messages.map((message) => ({
      id: message.id,
      authorId: message.authorId,
      authorName: message.author.name,
      authorEmail: message.author.email,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}
