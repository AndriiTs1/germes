import { DetailSection } from "@/components/sales/detail-section";
import { formatShortDate } from "@/components/sales/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { pluralize } from "@/lib/i18n/pluralize";
import type { SalesCustomerDetail } from "@/lib/services/sales/get-sales-customer-detail";

type OverviewField = { label: string; value: string };

/**
 * Only fields with a real value are shown — nulls are omitted from the
 * grid entirely rather than rendered as a dash, since Customer has many
 * optional fields and a fully-populated grid of dashes (e.g. Ресторан
 * Груп, which has no legalName/address/email/creditLimit) would look
 * broken rather than clean. creditLimit is shown as a bare number: the
 * schema has no currency for it, so no currency suffix is ever attached
 * here (see getSalesCustomerDetail's doc comment).
 */
export function CustomerDetailOverview({
  customer,
  locale,
  dictionary,
}: {
  customer: SalesCustomerDetail;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.customerDetail.overview;
  const fields: OverviewField[] = [];

  if (customer.contactPerson) fields.push({ label: t.contactPerson, value: customer.contactPerson });
  if (customer.phone) fields.push({ label: t.phone, value: customer.phone });
  if (customer.email) fields.push({ label: t.email, value: customer.email });
  if (customer.legalName) fields.push({ label: t.legalName, value: customer.legalName });
  if (customer.taxId) fields.push({ label: t.taxId, value: customer.taxId });
  if (customer.country) fields.push({ label: t.country, value: customer.country });
  if (customer.address) fields.push({ label: t.address, value: customer.address });

  fields.push({
    label: t.paymentTerms,
    value: pluralize(locale, customer.paymentTermDays, t.paymentTermsDays),
  });
  if (customer.creditLimit) fields.push({ label: t.creditLimit, value: customer.creditLimit });

  if (customer.lastContactAt) {
    fields.push({ label: t.lastContact, value: formatShortDate(customer.lastContactAt, locale) });
  }
  if (customer.lastPurchaseAt) {
    fields.push({ label: t.lastPurchase, value: formatShortDate(customer.lastPurchaseAt, locale) });
  }
  if (customer.nextActionAt) {
    fields.push({ label: t.nextAction, value: formatShortDate(customer.nextActionAt, locale) });
  }

  return (
    <DetailSection title={t.title}>
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
