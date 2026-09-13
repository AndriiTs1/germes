/**
 * The canonical Germes business-form field language — only the visual
 * properties genuinely shared by every field-shaped primitive (Input,
 * Select's trigger, Textarea). Layout (height, width, padding, flex
 * layout) is deliberately NOT here: it differs per primitive (an Input's
 * height isn't a Textarea's min-height, a Select trigger needs
 * `flex items-center justify-between` that an Input never does), so each
 * component composes this constant with its own layout classes via `cn()`
 * rather than this file trying to be a single one-size-fits-all class
 * string.
 *
 * Approved visual reference: Stage 8D.6 New Order /
 * components/sales/order-form/searchable-select.tsx.
 */
export const FIELD_BASE_CLASSNAME =
  "rounded-lg border border-slate-200/70 bg-white text-[13px] text-slate-700 transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:pointer-events-none disabled:opacity-50";
