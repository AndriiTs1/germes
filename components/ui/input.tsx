import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"
import { FIELD_BASE_CLASSNAME } from "@/components/ui/field-styles"

export type InputProps = React.ComponentProps<"input"> & {
  /**
   * Styles the field with the canonical Germes error border AND sets
   * aria-invalid automatically — callers never need to separately
   * remember to pass aria-invalid for the two to stay in sync. An
   * explicit aria-invalid prop, if given, is still respected as-is.
   */
  error?: boolean
}

function Input({ className, type, error, "aria-invalid": ariaInvalid, ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      aria-invalid={ariaInvalid ?? error}
      className={cn(
        FIELD_BASE_CLASSNAME,
        // text-base md:text-[13px] (not the base's fixed text-[13px]):
        // iOS Safari auto-zooms the visual viewport when a focused text
        // input's computed font-size is below 16px. Input is a real
        // text-entry control (unlike Select's/DateInput's button
        // triggers, which never trigger this and keep the base 13px
        // unchanged), so it needs the responsive override here.
        "h-9 w-full min-w-0 px-2.5 text-base file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-700 md:text-[13px]",
        error && "border-rose-300",
        className
      )}
      {...props}
    />
  )
}

export { Input }
