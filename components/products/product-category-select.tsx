"use client";

import { Tag } from "lucide-react";
import { useRouter } from "next/navigation";

import { buildProductListHref, type ProductStatusFilter } from "@/components/products/product-list-url";
import { Select } from "@/components/ui/select";

/**
 * Select-internal value for "all categories". The shared Select treats ""
 * as "nothing selected", so "all" gets its own value here and is mapped
 * back to "no category param" in the URL. Never sent to the server.
 */
const ALL_CATEGORIES = "__all__";

/**
 * Same pattern as SupplierCountrySelect: the project's canonical Select,
 * options built server-side from stored Product categories. Choosing one
 * navigates via the shared URL builder — q and status kept, page reset to 1.
 */
export function ProductCategorySelect({
  q,
  status,
  category,
  options,
  ariaLabel,
}: {
  q: string;
  status: ProductStatusFilter;
  category: string;
  /** value "" = all categories. */
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  const router = useRouter();

  const selectOptions = options.map((option) => ({
    value: option.value === "" ? ALL_CATEGORIES : option.value,
    label: option.label,
  }));

  return (
    <div className="relative w-full min-w-0 sm:w-56">
      <Tag
        className="pointer-events-none absolute top-1/2 left-3 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        strokeWidth={1.75}
      />
      <Select
        aria-label={ariaLabel}
        value={category || ALL_CATEGORIES}
        options={selectOptions}
        emptyMessage={options[0]?.label ?? ""}
        onValueChange={(next) =>
          router.push(buildProductListHref({ q, status, category: next === ALL_CATEGORIES ? "" : next }))
        }
        className="h-10 rounded-full pr-3 pl-9 hover:bg-slate-50 sm:h-9"
      />
    </div>
  );
}
