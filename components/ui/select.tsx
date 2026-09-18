"use client"

import { Check, ChevronDown } from "lucide-react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"
import { FIELD_BASE_CLASSNAME } from "@/components/ui/field-styles"

export type SelectOption = {
  value: string
  label: string
}

export type SelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  /** Shown in place of the option list when `options` is empty — always pass a localized string; this component never reads locale itself. */
  emptyMessage: string
  disabled?: boolean
  /**
   * Styles the trigger with the canonical Germes error border. Unlike
   * Input/Textarea, Select's trigger is a Base UI <button>, not a native
   * form control with its own validity state — there is no separate
   * aria-invalid to keep in sync here beyond this visual signal.
   */
  error?: boolean
  id?: string
  name?: string
  onBlur?: () => void
  "aria-label"?: string
  /** Applies to the trigger only — the popup's styling stays internal so its position/width behavior can't be accidentally broken by a caller. */
  className?: string
}

/**
 * Germes's canonical Select — the domain-agnostic generalization of the
 * approved Stage 8D.6 components/sales/order-form/searchable-select.tsx.
 * Same @base-ui/react/select wiring, same visual language, same popup
 * positioning (side="bottom" align="start" sideOffset={4}, width driven
 * by Base UI's own --anchor-width variable set on the Positioner from the
 * trigger's real measured width — never a guessed/fixed value). No SALES
 * import, no domain type, so it drops into any module unchanged.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  emptyMessage,
  disabled,
  error,
  id,
  name,
  onBlur,
  "aria-label": ariaLabel,
  className,
}: SelectProps) {
  const selectedOption = options.find((option) => option.value === value)

  return (
    <SelectPrimitive.Root
      value={value || null}
      onValueChange={(next) => onValueChange(next ?? "")}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        name={name}
        onBlur={onBlur}
        aria-label={ariaLabel}
        className={cn(
          FIELD_BASE_CLASSNAME,
          "flex h-9 w-full items-center justify-between gap-2 px-2.5 data-[popup-open]:border-blue-300 data-[popup-open]:ring-4 data-[popup-open]:ring-blue-500/10 disabled:pointer-events-none disabled:opacity-50",
          error && "border-rose-300",
          className
        )}
      >
        <SelectPrimitive.Value className="min-w-0 flex-1 truncate text-left data-[placeholder]:text-slate-400">
          {selectedOption ? selectedOption.label : placeholder}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="shrink-0 text-slate-400">
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          alignItemWithTrigger={false}
          className="z-50 w-[var(--anchor-width)] min-w-[var(--anchor-width)] max-w-[var(--anchor-width)] outline-none"
        >
          <SelectPrimitive.Popup className="w-full max-h-64 overflow-y-auto rounded-lg border border-slate-200/70 bg-white py-1 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.15),0_2px_6px_-2px_rgba(15,23,42,0.08)]">
            {options.length === 0 ? (
              <p className="px-2.5 py-2 text-[13px] text-slate-400">{emptyMessage}</p>
            ) : (
              options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-default items-center justify-between gap-2 px-2.5 py-1.5 text-[13px] text-slate-700 outline-none data-[highlighted]:bg-slate-50 data-[selected]:font-medium data-[selected]:text-slate-900"
                >
                  <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="shrink-0 text-slate-900">
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))
            )}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
