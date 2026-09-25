import { prisma } from "@/lib/db/prisma";

export async function getSupportTicket(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: {
      id: ticketId,
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
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      messages: {
        select: {
          id: true,
          authorId: true,
          body: true,
          createdAt: true,
          author: {
            select: {
              id: true,
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
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    messages: ticket.messages.map((message) => ({
      id: message.id,
      authorId: message.authorId,
      author: message.author,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}
