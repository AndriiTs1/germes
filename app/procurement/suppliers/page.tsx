import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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

/**
 * Canonical Supplier Directory. Same data, filters and behavior as the
 * directory currently rendered on /procurement (which stays as-is until the
 * real Procurement overview replaces it), with every URL and normalization
 * redirect under /procurement/suppliers via buildSupplierListHref.
 *
 * Access intentionally matches what /procurement grants today: both
 * procurement.overview.read AND suppliers.read. ACCOUNTING holds
 * suppliers.read but not procurement.overview.read, so it still has no
 * access here — widening that is a separate RBAC decision.
 */
export default async function ProcurementSuppliersPage(props: PageProps<"/procurement/suppliers">) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    // Same reasoning as every other workspace route: any failure here is
    // safest resolved by "/", which re-derives the correct destination.
    user = await requirePermission(PROCUREMENT_OVERVIEW_PERMISSION);
  } catch {
    redirect("/");
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);

  if (!permissionCodes.includes(SUPPLIERS_READ_PERMISSION)) {
    redirect("/");
  }

  const locale = await getCurrentLocale();
  const dictionary = getDictionary(locale);
  const t = dictionary.procurement;

  const searchParams = await props.searchParams;
  const rawQ = typeof searchParams?.q === "string" ? searchParams.q : undefined;
  const q = rawQ?.trim() ?? "";
  const status = parseStatusFilter(typeof searchParams?.status === "string" ? searchParams.status : undefined);
  const rawCountry = typeof searchParams?.country === "string" ? searchParams.country : "";
  const rawPage = typeof searchParams?.page === "string" ? Number(searchParams.page) : 1;
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const storedCountries = await listSupplierCountries();

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

  return (
    <DashboardShell
      user={user}
      permissionCodes={permissionCodes}
      activePath="/procurement/suppliers"
      dictionary={dictionary}
      showPeriodControl={false}
      // The directory has its own search; the global header search isn't
      // wired for the Procurement workspace (same as /procurement).
      showGlobalSearch={false}
    >
      <div className="pb-4">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight text-slate-900 md:leading-[1.5]">
          {t.suppliers.title}
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <section aria-label={t.suppliers.title} className="flex flex-col gap-4">
          <SupplierFilters
            q={q}
            status={status}
            country={country}
            countries={countries}
            resultCount={pluralize(locale, result.totalCount, t.suppliers.count)}
            dictionary={dictionary}
          />
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
      </div>
    </DashboardShell>
  );
}
