import * as React from "react"
import { cn } from "cn"
import { FIELD_BASE_CLASSNAME } from "@/components/ui/field-styles"

export type TextareaProps = React.ComponentProps<"textarea"> & {
  /** Same convention as Input — styles the error border AND sets aria-invalid automatically. */
  error?: boolean
}

function Textarea({ className, error, "aria-invalid": ariaInvalid, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      aria-invalid={ariaInvalid ?? error}
      className={cn(
        FIELD_BASE_CLASSNAME,
        // text-base md:text-[13px] — same iOS Safari auto-zoom prevention
        // as Input; see its comment for why. Textarea is always a real
        // text-entry control, so this override always applies.
        "w-full min-h-[72px] px-2.5 py-2 text-base md:text-[13px]",
        error && "border-rose-300",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
