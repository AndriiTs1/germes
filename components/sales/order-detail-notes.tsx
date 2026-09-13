import { DetailSection } from "@/components/sales/detail-section";

export function OrderDetailNotes({ notes }: { notes: string }) {
  return (
    <DetailSection title="Notes">
      <p className="text-[13px] whitespace-pre-line text-slate-700">{notes}</p>
    </DetailSection>
  );
}
