"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";

import { buildSupplierListHref, type SupplierStatusFilter } from "@/components/procurement/supplier-list-url";
import { Select } from "@/components/ui/select";

/**
 * Select-internal value for "all countries". The shared Select treats ""
 * as "nothing selected", so "all" gets its own value here and is mapped
 * back to "no country param" in the URL. Never sent to the server.
 */
const ALL_COUNTRIES = "__all__";

/**
 * One compact country filter built on the project's canonical Select
 * (components/ui/select.tsx, @base-ui/react/select): its popup opens
 * below the trigger and is locked to the trigger's measured width
 * (--anchor-width), so it never drifts or gets wider/narrower than the
 * field. Options come from stored Supplier values (built server-side).
 * Choosing one navigates via the shared URL builder: q and status kept,
 * page reset to 1, "all" removes the country param.
 */
export function SupplierCountrySelect({
  q,
  status,
  country,
  options,
  ariaLabel,
}: {
  q: string;
  status: SupplierStatusFilter;
  country: string;
  /** value "" = all countries. */
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  const router = useRouter();

  const selectOptions = options.map((option) => ({
    value: option.value === "" ? ALL_COUNTRIES : option.value,
    label: option.label,
  }));

  return (
    <div className="relative w-full min-w-0 sm:w-56">
      <Globe
        className="pointer-events-none absolute top-1/2 left-3 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        strokeWidth={1.75}
      />
      <Select
        aria-label={ariaLabel}
        value={country || ALL_COUNTRIES}
        options={selectOptions}
        emptyMessage={options[0]?.label ?? ""}
        onValueChange={(next) =>
          router.push(buildSupplierListHref({ q, status, country: next === ALL_COUNTRIES ? "" : next }))
        }
        className="h-10 rounded-full pr-3 pl-9 hover:bg-slate-50 sm:h-9"
      />
    </div>
  );
}
