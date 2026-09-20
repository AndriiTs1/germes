import { z } from "zod";

export const supportTicketCategorySchema = z.enum([
  "BUG",
  "QUESTION",
  "FEATURE_REQUEST",
  "ACCOUNT",
  "OTHER",
]);

export const createSupportTicketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  category: supportTicketCategorySchema,
  body: z.string().trim().min(10).max(10000),
});

export const addSupportMessageSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export const supportTicketIdSchema = z.string().uuid();

export type AddSupportMessageFormValues = z.infer<
  typeof addSupportMessageSchema
>;

export type CreateSupportTicketFormValues = z.infer<
  typeof createSupportTicketSchema
>;
