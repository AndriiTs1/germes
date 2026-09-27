import {
  formatAgreementPeriod,
  formatIncoterm,
  formatPaymentTermLines,
  formatPricePerKg,
  formatTierQuantity,
  resolveItemLeadTime,
} from "@/components/procurement/supplier-agreement-format";
import { SupplierAgreementStatusBadge } from "@/components/procurement/supplier-agreement-status";
import { DetailSection } from "@/components/sales/detail-section";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { pluralize } from "@/lib/i18n/pluralize";
import type {
  SupplierAgreementDetail,
  SupplierAgreementDetailItem,
} from "@/lib/services/procurement/get-supplier-agreement-detail";

const EMPTY_VALUE = "—";

type Field = { label: string; value: string | null };

/** Same label/value grid as the supplier overview; null renders the neutral dash. */
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

function Muted({ children }: { children: string }) {
  return <p className="text-[13px] text-slate-400">{children}</p>;
}

function AgreementItemCard({
  item,
  agreement,
  locale,
  dictionary,
}: {
  item: SupplierAgreementDetailItem;
  agreement: SupplierAgreementDetail;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.supplierDetail.agreementDetail;
  const kg = dictionary.common.kgUnit;
  const leadTime = resolveItemLeadTime(item.leadTimeDays, agreement.defaultLeadTimeDays);
  const leadTimeText =
    leadTime === null
      ? null
      : leadTime.source === "item"
        ? pluralize(locale, leadTime.days, t.leadTimeDays)
        : t.leadTimeFromAgreement.replace("{days}", pluralize(locale, leadTime.days, t.leadTimeDays));

  return (
    <li className="rounded-xl border border-slate-100 p-3">
      <p className="truncate text-[13px] font-semibold text-slate-900">{item.productName}</p>
      <p className="truncate text-[11.5px] text-slate-400">{item.sku}</p>
      <p className="mt-1.5 text-[12px] text-slate-500">
        {t.itemLeadTime}:{" "}
        <span className={leadTimeText === null ? "text-slate-400" : "font-medium text-slate-700"}>
          {leadTimeText ?? EMPTY_VALUE}
        </span>
      </p>

      {item.priceTiers.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-amber-600">{t.pricesNotSpecified}</p>
      ) : (
        <table className="mt-2 w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-slate-100 text-[10.5px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="py-1.5 pr-3">
                {t.tierQuantity}
              </th>
              <th scope="col" className="py-1.5 text-right">
                {t.tierPrice}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {item.priceTiers.map((tier) => (
              <tr key={tier.id}>
                <td className="py-1.5 pr-3 whitespace-nowrap text-slate-700">
                  {formatTierQuantity(tier.minQuantityKg, kg, locale)}
                </td>
                <td className="py-1.5 text-right font-medium whitespace-nowrap text-slate-900">
                  {formatPricePerKg(tier.pricePerKg, agreement.currency, kg, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}

/**
 * Read-only agreement card: title + derived status, then main / payment /
 * delivery terms (three cards side by side from lg), products with their
 * price tiers (one compact block per product — a two-column tier table
 * stays readable on a phone), and notes only when present. No actions.
 */
export function SupplierAgreementDetailView({
  agreement,
  locale,
  dictionary,
}: {
  agreement: SupplierAgreementDetail;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const t = dictionary.procurement.supplierDetail.agreementDetail;
  const listT = dictionary.procurement.supplierDetail.agreements;
  const statusLabels = dictionary.status.supplierAgreement;
  const period = formatAgreementPeriod(agreement, locale, listT);
  const paymentLines = formatPaymentTermLines(agreement, locale, listT);
  const incoterm = formatIncoterm(agreement);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="truncate text-[20px] leading-[1.3] font-semibold tracking-tight text-slate-900">
            {t.title.replace("{number}", agreement.agreementNumber)}
          </h2>
          <SupplierAgreementStatusBadge status={agreement.displayStatus} labels={statusLabels} size="md" />
        </div>
        <p className="mt-1 text-[13px] text-slate-500">
          {period} · {agreement.currency}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DetailSection title={t.sections.main}>
          <FieldGrid
            fields={[
              { label: t.fields.agreementNumber, value: agreement.agreementNumber },
              { label: t.fields.status, value: statusLabels[agreement.displayStatus] },
              { label: t.fields.period, value: period },
              { label: t.fields.currency, value: agreement.currency },
              {
                label: t.fields.defaultLeadTime,
                value:
                  agreement.defaultLeadTimeDays === null
                    ? null
                    : pluralize(locale, agreement.defaultLeadTimeDays, t.leadTimeDays),
              },
            ]}
          />
        </DetailSection>

        <DetailSection title={t.sections.payment}>
          {paymentLines.length === 0 ? (
            <Muted>{t.paymentNotSpecified}</Muted>
          ) : (
            <ul className="flex flex-col gap-1 text-[13.5px] font-medium text-slate-900">
              {paymentLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {agreement.paymentTermsNote ? (
            <div className="mt-3">
              <p className="text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">{t.additionalTerms}</p>
              <p className="mt-0.5 text-[13px] whitespace-pre-line text-slate-700">{agreement.paymentTermsNote}</p>
            </div>
          ) : null}
        </DetailSection>

        <DetailSection title={t.sections.delivery}>
          {incoterm === null ? (
            <Muted>{t.incotermsNotSpecified}</Muted>
          ) : (
            <>
              <p className="text-[13.5px] font-medium break-words text-slate-900">{incoterm}</p>
              {agreement.incotermVersion !== null ? (
                <p className="mt-0.5 text-[12px] text-slate-400">
                  {t.incotermsVersion.replace("{version}", String(agreement.incotermVersion))}
                </p>
              ) : null}
            </>
          )}
        </DetailSection>
      </div>

      <DetailSection title={t.sections.items}>
        {agreement.items.length === 0 ? (
          <Muted>{t.itemsEmpty}</Muted>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {agreement.items.map((item) => (
              <AgreementItemCard
                key={item.id}
                item={item}
                agreement={agreement}
                locale={locale}
                dictionary={dictionary}
              />
            ))}
          </ul>
        )}
      </DetailSection>

      {agreement.notes ? (
        <DetailSection title={t.sections.notes}>
          <p className="text-[13px] whitespace-pre-line text-slate-700">{agreement.notes}</p>
        </DetailSection>
      ) : null}
    </div>
  );
}
