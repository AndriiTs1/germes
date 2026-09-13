import { DetailSection } from "@/components/sales/detail-section";
import { formatShortDate } from "@/components/sales/format";
import type { SalesCustomerDetail } from "@/lib/services/sales/get-sales-customer-detail";

type OverviewField = { label: string; value: string };

function formatPaymentTerms(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Only fields with a real value are shown — nulls are omitted from the
 * grid entirely rather than rendered as a dash, since Customer has many
 * optional fields and a fully-populated grid of dashes (e.g. Ресторан
 * Груп, which has no legalName/address/email/creditLimit) would look
 * broken rather than clean. creditLimit is shown as a bare number: the
 * schema has no currency for it, so no currency suffix is ever attached
 * here (see getSalesCustomerDetail's doc comment).
 */
export function CustomerDetailOverview({ customer }: { customer: SalesCustomerDetail }) {
  const fields: OverviewField[] = [];

  if (customer.contactPerson) fields.push({ label: "Contact person", value: customer.contactPerson });
  if (customer.phone) fields.push({ label: "Phone", value: customer.phone });
  if (customer.email) fields.push({ label: "Email", value: customer.email });
  if (customer.legalName) fields.push({ label: "Legal name", value: customer.legalName });
  if (customer.taxId) fields.push({ label: "Tax ID", value: customer.taxId });
  if (customer.country) fields.push({ label: "Country", value: customer.country });
  if (customer.address) fields.push({ label: "Address", value: customer.address });

  fields.push({ label: "Payment terms", value: formatPaymentTerms(customer.paymentTermDays) });
  if (customer.creditLimit) fields.push({ label: "Credit limit", value: customer.creditLimit });

  if (customer.lastContactAt) {
    fields.push({ label: "Last contact", value: formatShortDate(customer.lastContactAt) });
  }
  if (customer.lastPurchaseAt) {
    fields.push({ label: "Last purchase", value: formatShortDate(customer.lastPurchaseAt) });
  }
  if (customer.nextActionAt) {
    fields.push({ label: "Next action", value: formatShortDate(customer.nextActionAt) });
  }

  return (
    <DetailSection title="Overview">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 min-[640px]:grid-cols-3 min-[1024px]:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label} className="min-w-0">
            <dt className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              {field.label}
            </dt>
            <dd className="mt-0.5 truncate text-[13.5px] font-medium text-slate-900">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </DetailSection>
  );
}
