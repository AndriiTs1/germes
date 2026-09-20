import { prisma } from "@/lib/db/prisma";

export type MySupportTicketListItem = {
  id: string;
  number: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messageCount: number;
};

export type ListMySupportTicketsOptions = {
  page?: number;
  limit?: number;
};

export type ListMySupportTicketsResult = {
  tickets: MySupportTicketListItem[];
  totalCount: number;
  page: number;
  pageCount: number;
};

/**
 * Lists support tickets owned by exactly one Germes user.
 *
 * Ownership is enforced in the database WHERE clause using createdById.
 * The caller must resolve the authenticated active user and pass that
 * trusted user.id.
 */
export async function listMySupportTickets(
  currentUserId: string,
  options: ListMySupportTicketsOptions = {},
): Promise<ListMySupportTicketsResult> {
  const requestedPage = options.page ?? 1;
  const requestedLimit = options.limit ?? 20;

  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const limit =
    Number.isSafeInteger(requestedLimit) &&
    requestedLimit > 0 &&
    requestedLimit <= 100
      ? requestedLimit
      : 20;

  const where = {
    createdById: currentUserId,
  };

  const [tickets, totalCount] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
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
    prisma.supportTicket.count({ where }),
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
      messageCount: ticket._count.messages,
    })),
    totalCount,
    page,
    pageCount: Math.max(1, Math.ceil(totalCount / limit)),
  };
}
