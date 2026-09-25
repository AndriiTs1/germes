import { z } from "zod";

export const internalSupportMessageSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export const internalSupportTicketUpdateSchema = z
  .object({
    status: z
      .enum([
        "NEW",
        "IN_PROGRESS",
        "WAITING_CUSTOMER",
        "RESOLVED",
        "CLOSED",
      ])
      .optional(),
    priority: z
      .enum([
        "LOW",
        "NORMAL",
        "HIGH",
        "URGENT",
      ])
      .optional(),
    assignedToId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.priority !== undefined ||
      value.assignedToId !== undefined,
    {
      message: "At least one support ticket field must be updated",
    },
  );

export const internalSupportTicketIdSchema = z.string().uuid();

export type InternalSupportTicketUpdateInput = z.infer<
  typeof internalSupportTicketUpdateSchema
>;
