import { DetailSection } from "@/components/sales/detail-section";
import { displayNotes } from "@/lib/display-notes";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SupplierDetail } from "@/lib/services/procurement/get-supplier-detail";

type Field = {
  label: string;
  value: string;
};

function FieldGrid({ fields }: { fields: Field[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 min-[480px]:grid-cols-2 min-[1024px]:grid-cols-4">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
            {field.label}
          </dt>
          <dd className="mt-0.5 text-[13.5px] font-medium break-words text-slate-900">
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Compact read-only supplier overview.
 * Missing optional values are omitted instead of occupying large cards
 * with placeholders. The supplier code remains as the stable base field.
 */
export function SupplierDetailOverview({
  supplier,
  dictionary,
}: {
  supplier: SupplierDetail;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.supplierDetail;
  const responsibleName = supplier.responsible
    ? (supplier.responsible.name ?? supplier.responsible.email)
    : null;

  const optionalFields = [
    { label: t.fields.legalName, value: supplier.legalName },
    { label: t.fields.taxId, value: supplier.taxId },
    { label: t.fields.contactPerson, value: supplier.contactPerson },
    { label: t.fields.phone, value: supplier.phone },
    { label: t.fields.email, value: supplier.email },
    { label: t.fields.address, value: supplier.address },
    { label: t.fields.responsible, value: responsibleName },
  ];

  const fields: Field[] = optionalFields
    .filter(
      (field): field is { label: string; value: string } =>
        field.value !== null && field.value.trim() !== "",
    )
    .map((field) => ({
      label: field.label,
      value: field.value,
    }));

  const notes = displayNotes(supplier.notes);

  return (
    <div className="flex flex-col gap-4">
      {fields.length > 0 ? (
        <DetailSection title={t.sections.main}>
          <FieldGrid fields={fields} />
        </DetailSection>
      ) : (
        <p className="text-[13px] text-slate-400">
          {t.overviewEmpty}
        </p>
      )}

      {notes ? (
        <DetailSection title={t.sections.notes}>
          <p className="text-[13px] whitespace-pre-line text-slate-700">
            {notes}
          </p>
        </DetailSection>
      ) : null}
    </div>
  );
}
