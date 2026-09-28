import { DetailSection } from "@/components/sales/detail-section";
import { displayNotes } from "@/lib/display-notes";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/** Hides internal markers; renders nothing when no user-written text remains. */
export function CustomerDetailNotes({ notes, dictionary }: { notes: string | null; dictionary: Dictionary }) {
  const text = displayNotes(notes);
  if (text === null) return null;
  return (
    <DetailSection title={dictionary.customerDetail.notes.title}>
      <p className="text-[13px] whitespace-pre-line text-slate-700">{text}</p>
    </DetailSection>
  );
}
