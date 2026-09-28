import { DetailSection } from "@/components/sales/detail-section";
import { displayNotes } from "@/lib/display-notes";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SupplierDetail } from "@/lib/services/procurement/get-supplier-detail";

/** One neutral placeholder for every missing value (seed suppliers are mostly sparse). */
const EMPTY_VALUE = "—";

type Field = { label: string; value: string | null };

function FieldGrid({ fields }: { fields: Field[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 min-[480px]:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">{field.label}</dt>
          <dd
            className={
              field.value === null
                ? "mt-0.5 text-[13.5px] font-medium text-slate-400"
                : "mt-0.5 text-[13.5px] font-medium break-words text-slate-900"
            }
          >
            {field.value ?? EMPTY_VALUE}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Read-only Supplier facts in four small groups. Unlike the customer
 * overview, empty fields are kept (shown as "—") so every supplier card
 * has the same shape. paymentTermDays is intentionally absent — see
 * getSupplierDetail.
 */
export function SupplierDetailOverview({
  supplier,
  dictionary,
}: {
  supplier: SupplierDetail;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.supplierDetail;
  const responsibleName = supplier.responsible ? (supplier.responsible.name ?? supplier.responsible.email) : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DetailSection title={t.sections.main}>
        <FieldGrid
          fields={[
            { label: t.fields.code, value: supplier.code },
            { label: t.fields.legalName, value: supplier.legalName },
            { label: t.fields.taxId, value: supplier.taxId },
            { label: t.fields.country, value: supplier.country },
          ]}
        />
      </DetailSection>

      <DetailSection title={t.sections.contacts}>
        <FieldGrid
          fields={[
            { label: t.fields.contactPerson, value: supplier.contactPerson },
            { label: t.fields.phone, value: supplier.phone },
            { label: t.fields.email, value: supplier.email },
            { label: t.fields.address, value: supplier.address },
          ]}
        />
      </DetailSection>

      <DetailSection title={t.sections.responsible}>
        <FieldGrid fields={[{ label: t.fields.responsible, value: responsibleName }]} />
      </DetailSection>

      <DetailSection title={t.sections.notes}>
        {displayNotes(supplier.notes) === null ? (
          <p className="text-[13px] font-medium text-slate-400">{EMPTY_VALUE}</p>
        ) : (
          <p className="text-[13px] whitespace-pre-line text-slate-700">{displayNotes(supplier.notes)}</p>
        )}
      </DetailSection>
    </div>
  );
}
