import { DetailSection } from "@/components/sales/detail-section";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function OrderDetailNotes({ notes, dictionary }: { notes: string; dictionary: Dictionary }) {
  return (
    <DetailSection title={dictionary.orderDetail.notes.title}>
      <p className="text-[13px] whitespace-pre-line text-slate-700">{notes}</p>
    </DetailSection>
  );
}
