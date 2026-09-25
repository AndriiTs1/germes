import { prisma } from "@/lib/db/prisma";

type ListSupportTicketsOptions = {
  page?: number;
  limit?: number;
};

export async function listSupportTickets(
  options: ListSupportTicketsOptions = {},
) {
  const page =
    Number.isInteger(options.page) && (options.page ?? 0) > 0
      ? options.page!
      : 1;

  const requestedLimit = options.limit ?? 25;
  const limit =
    Number.isInteger(requestedLimit) &&
    requestedLimit >= 1 &&
    requestedLimit <= 100
      ? requestedLimit
      : 25;

  const [tickets, total] = await prisma.$transaction([
    prisma.supportTicket.findMany({
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
        createdBy: {
          select: {
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
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: [
        { lastMessageAt: "desc" },
        { number: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.supportTicket.count(),
  ]);

  return {
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      lastMessageAt: ticket.lastMessageAt.toISOString(),
      createdBy: ticket.createdBy,
      assignedTo: ticket.assignedTo,
      messageCount: ticket._count.messages,
    })),
    pagination: {
      page,
      limit,
      total,
      pageCount: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
