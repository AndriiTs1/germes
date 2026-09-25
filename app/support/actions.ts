"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/permissions/require-permission";
import { addInternalSupportMessage } from "@/lib/services/support/add-internal-support-message";
import { updateSupportTicket } from "@/lib/services/support/update-support-ticket";
import {
  internalSupportMessageSchema,
  internalSupportTicketIdSchema,
  internalSupportTicketUpdateSchema,
  type InternalSupportTicketUpdateInput,
} from "@/lib/validation/internal-support";

const SUPPORT_WORKSPACE_PERMISSION = "support.workspace.access";

export async function addInternalSupportMessageAction(
  ticketId: string,
  input: { body: string },
): Promise<{ error: string } | void> {
  const user = await requirePermission(
    SUPPORT_WORKSPACE_PERMISSION,
  ).catch(() => null);

  if (!user) {
    return { error: "Support access denied." };
  }

  const parsedTicketId =
    internalSupportTicketIdSchema.safeParse(ticketId);

  const parsedInput =
    internalSupportMessageSchema.safeParse(input);

  if (!parsedTicketId.success || !parsedInput.success) {
    return { error: "Invalid support message." };
  }

  const result = await addInternalSupportMessage(
    user.id,
    parsedTicketId.data,
    parsedInput.data.body,
  );

  if (!result.ok) {
    if (result.error === "TICKET_CLOSED") {
      return { error: "This request is closed." };
    }

    if (result.error === "TICKET_UNAVAILABLE") {
      return { error: "This request is no longer available." };
    }

    return { error: "Could not send the message." };
  }

  revalidatePath("/support");
  revalidatePath(`/support/${parsedTicketId.data}`);
}

export async function updateInternalSupportTicketAction(
  ticketId: string,
  input: InternalSupportTicketUpdateInput,
): Promise<{ error: string } | void> {
  const user = await requirePermission(
    SUPPORT_WORKSPACE_PERMISSION,
  ).catch(() => null);

  if (!user) {
    return { error: "Support access denied." };
  }

  const parsedTicketId =
    internalSupportTicketIdSchema.safeParse(ticketId);

  const parsedInput =
    internalSupportTicketUpdateSchema.safeParse(input);

  if (!parsedTicketId.success || !parsedInput.success) {
    return { error: "Invalid support ticket update." };
  }

  const result = await updateSupportTicket(
    user.id,
    parsedTicketId.data,
    parsedInput.data,
  );

  if (!result.ok) {
    if (result.error === "INVALID_ASSIGNEE") {
      return { error: "Selected support agent is not available." };
    }

    if (result.error === "TICKET_UNAVAILABLE") {
      return { error: "This request is no longer available." };
    }

    return { error: "Could not update the request." };
  }

  revalidatePath("/support");
  revalidatePath(`/support/${parsedTicketId.data}`);
}
