"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { addSupportMessage } from "@/lib/services/support/add-support-message";
import { createSupportTicket } from "@/lib/services/support/create-support-ticket";
import {
  addSupportMessageSchema,
  createSupportTicketSchema,
  supportTicketIdSchema,
  type AddSupportMessageFormValues,
  type CreateSupportTicketFormValues,
} from "@/lib/validation/support";

export async function createSupportTicketAction(
  input: CreateSupportTicketFormValues,
): Promise<{ error: string } | void> {
  const locale = await getCurrentLocale();
  const t = getDictionary(locale).settings.support;

  const user = await requireUser().catch(() => null);

  if (!user) {
    return { error: t.createError };
  }

  const parsed = createSupportTicketSchema.safeParse(input);

  if (!parsed.success) {
    return { error: t.createError };
  }

  const result = await createSupportTicket(user.id, parsed.data);

  if (!result.ok) {
    return { error: t.createError };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/support");

  redirect(`/settings/support/${result.ticketId}`);
}

export async function addSupportMessageAction(
  ticketId: string,
  input: AddSupportMessageFormValues,
): Promise<{ error: string } | void> {
  const locale = await getCurrentLocale();
  const t = getDictionary(locale).settings.support;

  const user = await requireUser().catch(() => null);

  if (!user) {
    return { error: t.messageError };
  }

  const parsedTicketId = supportTicketIdSchema.safeParse(ticketId);
  const parsedInput = addSupportMessageSchema.safeParse(input);

  if (!parsedTicketId.success || !parsedInput.success) {
    return { error: t.messageError };
  }

  const result = await addSupportMessage(
    user.id,
    parsedTicketId.data,
    parsedInput.data.body,
  );

  if (!result.ok) {
    if (result.error === "TICKET_UNAVAILABLE") {
      return { error: t.ticketUnavailable };
    }

    if (result.error === "TICKET_CLOSED") {
      return { error: t.ticketClosed };
    }

    return { error: t.messageError };
  }

  revalidatePath("/settings/support");
  revalidatePath(`/settings/support/${parsedTicketId.data}`);
}
