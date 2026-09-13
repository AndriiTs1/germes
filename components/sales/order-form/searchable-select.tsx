"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select } from "@base-ui/react/select";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
  name?: string;
  onBlur?: () => void;
  "aria-label"?: string;
};

const TRIGGER_CLASSNAME =
  "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white px-2.5 text-[13px] text-slate-700 transition-colors focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 focus:outline-none data-[popup-open]:border-blue-300 data-[popup-open]:ring-4 data-[popup-open]:ring-blue-500/10 disabled:pointer-events-none disabled:opacity-50";

/**
 * Germes's first SALES-native dropdown. Built on @base-ui/react/select —
 * already a project dependency and already the primitive underneath
 * components/ui/button.tsx/input.tsx — rather than a hand-rolled listbox,
 * so focus management, Tab/Arrow-key/Enter/Escape behavior, and
 * highlighted/selected ARIA semantics all come from the library, not a
 * custom reimplementation. Styled with the same plain Tailwind language
 * every /sales/* page already uses (border-slate-200/70,
 * focus:border-blue-300/focus:ring-blue-500/10, text-[13px]) rather than
 * the components/ui kit's separate CSS-variable token set, which no SALES
 * page uses today.
 *
 * Popup width is driven entirely by Base UI's own `--anchor-width` CSS
 * variable, set on the Positioner from the trigger's real measured width
 * — never a guessed/fixed pixel value, so it always matches the trigger
 * exactly, in whatever container it's placed (a 4-column desktop grid
 * cell or a full-width mobile card).
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  error,
  id,
  name,
  onBlur,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Select.Root
      value={value || null}
      onValueChange={(next) => onValueChange(next ?? "")}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        name={name}
        onBlur={onBlur}
        aria-label={ariaLabel}
        className={cn(TRIGGER_CLASSNAME, error && "border-rose-300")}
      >
        <Select.Value className="min-w-0 flex-1 truncate text-left data-[placeholder]:text-slate-400">
          {selectedOption ? selectedOption.label : placeholder}
        </Select.Value>
        <Select.Icon className="shrink-0 text-slate-400">
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          alignItemWithTrigger={false}
          className="z-50 w-[var(--anchor-width)] outline-none"
        >
          <Select.Popup className="max-h-64 overflow-y-auto rounded-lg border border-slate-200/70 bg-white py-1 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.15),0_2px_6px_-2px_rgba(15,23,42,0.08)]">
            {options.length === 0 ? (
              <p className="px-2.5 py-2 text-[13px] text-slate-400">No options</p>
            ) : (
              options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-default items-center justify-between gap-2 px-2.5 py-1.5 text-[13px] text-slate-700 outline-none data-[highlighted]:bg-slate-50 data-[selected]:font-medium data-[selected]:text-slate-900"
                >
                  <Select.ItemText className="min-w-0 flex-1 truncate">
                    {option.label}
                  </Select.ItemText>
                  <Select.ItemIndicator className="shrink-0 text-slate-900">
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))
            )}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
