import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProcurementOverview } from "@/components/procurement/procurement-overview";
import { SupplierFilters } from "@/components/procurement/supplier-filters";
import { SupplierList } from "@/components/procurement/supplier-list";
import {
  buildSupplierListHref,
  SUPPLIER_STATUSES,
  type SupplierStatusFilter,
} from "@/components/procurement/supplier-list-url";
import { SupplierPagination } from "@/components/procurement/supplier-pagination";
import { INTL_LOCALE_MAP } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCurrentLocale } from "@/lib/i18n/locale";
import { pluralize } from "@/lib/i18n/pluralize";
import { getPermissionCodesForUser } from "@/lib/permissions/get-current-user-permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  getProcurementOverview,
  type ProcurementOverview as ProcurementOverviewData,
} from "@/lib/services/procurement/get-procurement-overview";
import {
  listSupplierCountries,
  listSuppliers,
  SUPPLIER_COUNTRY_NONE,
} from "@/lib/services/procurement/list-suppliers";

const PROCUREMENT_OVERVIEW_PERMISSION = "procurement.overview.read";
const SUPPLIERS_READ_PERMISSION = "suppliers.read";

/** Only exact SupplierStatus enum values are accepted from the URL; anything else = all. */
function parseStatusFilter(value: string | undefined): SupplierStatusFilter {
  return value && (SUPPLIER_STATUSES as readonly string[]).includes(value)
    ? (value as SupplierStatusFilter)
    : "all";
}

export default async function ProcurementPage(props: PageProps<"/procurement">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route (/sales, /warehouse):
    // any failure here (unauthenticated or missing this permission) is
    // safest resolved by "/", which re-derives the correct destination from
    // the user's real permissions.
    user = await requirePermission(PROCUREMENT_OVERVIEW_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);

  // Per-widget check before any query, as in SalesWorkspace: supplier counts
  // and the supplier list are supplier data, fetched only with suppliers.read.
  const canReadSuppliers = permissionCodes.includes(SUPPLIERS_READ_PERMISSION);

  let supplierSection: ReactNode = null;
  let overview: ProcurementOverviewData | null = null;

  if (canReadSuppliers) {
    const searchParams = await props.searchParams;
    const rawQ = typeof searchParams?.q === "string" ? searchParams.q : undefined;
    const q = rawQ?.trim() ?? "";
    const status = parseStatusFilter(typeof searchParams?.status === "string" ? searchParams.status : undefined);
    const rawCountry = typeof searchParams?.country === "string" ? searchParams.country : "";
    const rawPage = typeof searchParams?.page === "string" ? Number(searchParams.page) : 1;
    const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

    const [overviewData, storedCountries] = await Promise.all([getProcurementOverview(), listSupplierCountries()]);
    overview = overviewData;

    // Country must be an exact stored value or the "not specified" sentinel;
    // an unknown value is dropped (redirect) rather than trusted.
    if (rawCountry && rawCountry !== SUPPLIER_COUNTRY_NONE && !storedCountries.includes(rawCountry)) {
      redirect(buildSupplierListHref({ q, status, country: "" }));
    }
    const country = rawCountry;

    // Normalize the search in the URL: "   тов   " → ?q=тов, and an empty
    // q= is dropped. Status/country are kept; a new search lands on page 1.
    if (rawQ !== undefined && (rawQ !== q || q === "")) {
      redirect(buildSupplierListHref({ q, status, country }));
    }

    const result = await listSuppliers({
      search: q || undefined,
      status: status === "all" ? undefined : status,
      country: country || undefined,
      page: requestedPage,
    });

    if (requestedPage > result.pageCount) {
      redirect(buildSupplierListHref({ q, status, country, page: result.pageCount }));
    }

    const collator = new Intl.Collator(INTL_LOCALE_MAP[locale]);
    const countries = [...storedCountries].sort((a, b) => collator.compare(a, b));

    supplierSection = (
      <section aria-labelledby="suppliers-heading" className="mt-2 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="suppliers-heading" className="text-[15px] font-semibold tracking-tight text-slate-900">
            {dictionary.procurement.suppliers.title}
          </h2>
          <p className="text-[12.5px] whitespace-nowrap text-slate-500">
            {pluralize(locale, result.totalCount, dictionary.procurement.suppliers.count)}
          </p>
        </div>
        <SupplierFilters q={q} status={status} country={country} countries={countries} dictionary={dictionary} />
        <SupplierList
          suppliers={result.items}
          hasAnySuppliers={result.allCount > 0}
          clearFiltersHref={buildSupplierListHref({ q: "", status: "all", country: "" })}
          dictionary={dictionary}
        />
        <SupplierPagination
          page={result.page}
          pageCount={result.pageCount}
          query={{ q, status, country }}
          dictionary={dictionary}
        />
      </section>
    );
  }

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/procurement"
      dictionary={dictionary}
      showPeriodControl={false}
      // The supplier section has its own (working) search; hide the global
      // header search here so the page doesn't show two search fields.
      showGlobalSearch={false}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {dictionary.procurement.workspace.title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">{dictionary.procurement.workspace.subtitle}</p>
      </div>

      <ProcurementOverview overview={overview} dictionary={dictionary}>
        {supplierSection}
      </ProcurementOverview>
    </DashboardShell>
  );
}
