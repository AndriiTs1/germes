"use client"

import * as React from "react"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"
import { FIELD_BASE_CLASSNAME } from "@/components/ui/field-styles"
import { DEFAULT_LOCALE, INTL_LOCALE_MAP, type Locale } from "@/lib/i18n/config"

export type DateInputProps = {
  /** Canonical value: "YYYY-MM-DD", or undefined/empty for no selection. Never a Date object. */
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  id?: string
  name?: string
  onBlur?: () => void
  /** "YYYY-MM-DD" — dates before this are disabled. Invalid/absent = no lower bound. */
  min?: string
  /** "YYYY-MM-DD" — dates after this are disabled. Invalid/absent = no upper bound. */
  max?: string
  "aria-label"?: string
  /** Drives the calendar's weekday/month names via Intl.DateTimeFormat — never a hand-translated label array. Defaults to English. */
  locale?: Locale
  /** aria-label for the "previous month" nav button. Defaults to English. */
  previousMonthLabel?: string
  /** aria-label for the "next month" nav button. Defaults to English. */
  nextMonthLabel?: string
  /** Applies to the trigger only — the popup's own sizing/positioning stays internal. */
  className?: string
}

type DateParts = { year: number; month: number; day: number } // month is 0-indexed, matching Date's own convention

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * 2023-01-01 was a Sunday (UTC) — a stable, arbitrary reference week/year
 * used only to ask Intl for each weekday's/month's real localized name; the
 * actual year/day never appears in the output.
 */
function buildWeekdayLabels(intlLocale: string): string[] {
  const formatter = new Intl.DateTimeFormat(intlLocale, { weekday: "short" })
  return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(Date.UTC(2023, 0, 1 + i))))
}

function buildMonthLabels(intlLocale: string, month: "short" | "long"): string[] {
  const formatter = new Intl.DateTimeFormat(intlLocale, { month })
  return Array.from({ length: 12 }, (_, i) => formatter.format(new Date(Date.UTC(2023, i, 1))))
}

/**
 * Strict "YYYY-MM-DD" -> parts parse. Rejects malformed strings AND
 * impossible calendar dates (e.g. "2026-02-30") by reconstructing via
 * Date.UTC and reading the result back — the same rollover-safe pattern
 * already used in lib/validation/sales-order.ts. Only ever touches
 * getUTC* accessors, never local-timezone ones, so this is safe
 * regardless of the browser's own timezone.
 */
function parseISODate(value: string | undefined): DateParts | null {
  if (!value) return null
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month, day))

  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month || utc.getUTCDate() !== day) {
    return null
  }

  return { year, month, day }
}

function formatISODate({ year, month, day }: DateParts): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Sortable integer for min/max/equality comparisons — never a Date object. */
function toComparable({ year, month, day }: DateParts): number {
  return year * 10000 + month * 100 + day
}

/**
 * "Today" is inherently a local-wall-clock concept (what day is it right
 * now, for this user) — unlike parseISODate above, using local accessors
 * here on a fresh `new Date()` (an actual instant, not a parsed date-only
 * string) is correct, not the off-by-one hazard the rest of this file
 * deliberately avoids.
 */
function todayParts(): DateParts {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() }
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of "next month" is the last day of "this month" — UTC-safe.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 1)).getUTCDay()
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const utc = new Date(Date.UTC(year, month + delta, 1))
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() }
}

function addDays(year: number, month: number, day: number, delta: number): DateParts {
  const utc = new Date(Date.UTC(year, month, day + delta))
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth(), day: utc.getUTCDate() }
}

/**
 * Germes's canonical date field — a compact custom trigger + popup
 * calendar, never a native <input type="date">. That native control's
 * picker is rendered by the OS/browser shell itself (a full-width iOS
 * bottom sheet with no DOM presence), so no CSS can resize or restyle it;
 * the only fix is not using it at all. Built on @base-ui/react/popover
 * (already a project dependency) for open/close, outside-press/Escape
 * dismissal, viewport collision avoidance, and focus return — this file
 * only adds the calendar grid and its keyboard behavior, which Base UI
 * has no primitive for.
 */
export function DateInput({
  value,
  onValueChange,
  placeholder = "Select a date",
  disabled,
  error,
  id,
  name,
  onBlur,
  min,
  max,
  "aria-label": ariaLabel,
  locale = DEFAULT_LOCALE,
  previousMonthLabel = "Previous month",
  nextMonthLabel = "Next month",
  className,
}: DateInputProps) {
  const [open, setOpen] = React.useState(false)
  const [viewYear, setViewYear] = React.useState(() => todayParts().year)
  const [viewMonth, setViewMonth] = React.useState(() => todayParts().month)
  const [activeDay, setActiveDay] = React.useState(() => todayParts().day)
  const dayButtonRefs = React.useRef(new Map<number, HTMLButtonElement>())
  const pendingFocusDay = React.useRef<number | null>(null)

  const intlLocale = INTL_LOCALE_MAP[locale]
  const weekdayLabels = React.useMemo(() => buildWeekdayLabels(intlLocale), [intlLocale])
  const monthLabelsShort = React.useMemo(() => buildMonthLabels(intlLocale, "short"), [intlLocale])
  const monthLabelsFull = React.useMemo(() => buildMonthLabels(intlLocale, "long"), [intlLocale])

  const selected = parseISODate(value)
  const minParts = parseISODate(min)
  const maxParts = parseISODate(max)
  const minComparable = minParts ? toComparable(minParts) : null
  const maxComparable = maxParts ? toComparable(maxParts) : null

  function isDisabledDate(parts: DateParts): boolean {
    const comparable = toComparable(parts)
    if (minComparable !== null && comparable < minComparable) return true
    if (maxComparable !== null && comparable > maxComparable) return true
    return false
  }

  // Re-derives the visible month from the current (possibly invalid)
  // value every time the popup opens — never from a stale render — so a
  // malformed/absent value always falls back to today's month rather
  // than crashing or showing NaN, and this never itself calls
  // onValueChange (an invalid external value is never silently replaced).
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const base = selected ?? todayParts()
      setViewYear(base.year)
      setViewMonth(base.month)
      setActiveDay(base.day)
    }
    setOpen(nextOpen)
  }

  function selectDate(parts: DateParts) {
    if (isDisabledDate(parts)) return
    onValueChange(formatISODate(parts))
    setOpen(false)
  }

  function goToMonth(delta: number) {
    const next = addMonths(viewYear, viewMonth, delta)
    setViewYear(next.year)
    setViewMonth(next.month)
    setActiveDay((day) => Math.min(day, daysInMonth(next.year, next.month)))
  }

  function moveActiveDay(delta: number) {
    const next = addDays(viewYear, viewMonth, activeDay, delta)
    const crossesMonth = next.year !== viewYear || next.month !== viewMonth
    if (crossesMonth) {
      // The target button doesn't exist until the month grid re-renders —
      // focus it in the effect below once it does.
      pendingFocusDay.current = next.day
      setViewYear(next.year)
      setViewMonth(next.month)
    } else {
      dayButtonRefs.current.get(next.day)?.focus()
    }
    setActiveDay(next.day)
  }

  React.useEffect(() => {
    if (pendingFocusDay.current === null) return
    dayButtonRefs.current.get(pendingFocusDay.current)?.focus()
    pendingFocusDay.current = null
  }, [viewYear, viewMonth])

  function handleDayKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault()
        moveActiveDay(-1)
        break
      case "ArrowRight":
        event.preventDefault()
        moveActiveDay(1)
        break
      case "ArrowUp":
        event.preventDefault()
        moveActiveDay(-7)
        break
      case "ArrowDown":
        event.preventDefault()
        moveActiveDay(7)
        break
      case "Enter":
      case " ":
        event.preventDefault()
        selectDate({ year: viewYear, month: viewMonth, day: activeDay })
        break
      default:
        break
    }
  }

  const today = todayParts()
  const daysCount = daysInMonth(viewYear, viewMonth)
  const leadingBlanks = firstWeekdayOfMonth(viewYear, viewMonth)
  const cells: (DateParts | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysCount }, (_, i) => ({ year: viewYear, month: viewMonth, day: i + 1 })),
  ]

  const prevMonthTarget = addMonths(viewYear, viewMonth, -1)
  const nextMonthTarget = addMonths(viewYear, viewMonth, 1)
  const prevMonthLastDay: DateParts = {
    year: prevMonthTarget.year,
    month: prevMonthTarget.month,
    day: daysInMonth(prevMonthTarget.year, prevMonthTarget.month),
  }
  const nextMonthFirstDay: DateParts = { year: nextMonthTarget.year, month: nextMonthTarget.month, day: 1 }
  const isPrevMonthDisabled = minComparable !== null && toComparable(prevMonthLastDay) < minComparable
  const isNextMonthDisabled = maxComparable !== null && toComparable(nextMonthFirstDay) > maxComparable

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        id={id}
        name={name}
        disabled={disabled}
        onBlur={onBlur}
        aria-label={ariaLabel}
        aria-invalid={error}
        className={cn(
          FIELD_BASE_CLASSNAME,
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 px-2.5 text-left data-[popup-open]:border-blue-300 data-[popup-open]:ring-4 data-[popup-open]:ring-blue-500/10",
          error && "border-rose-300",
          className
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-slate-400")}>
          {selected ? `${selected.day} ${monthLabelsShort[selected.month]} ${selected.year}` : placeholder}
        </span>
        <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={4} className="z-50 outline-none">
          <PopoverPrimitive.Popup
            // Base UI's default "first tabbable element" would land on the
            // Previous-month button (first in DOM order) instead of the
            // active day — explicitly focus the roving-tabindex day cell
            // so arrow-key navigation works immediately after opening.
            initialFocus={() => dayButtonRefs.current.get(activeDay) ?? true}
            className="w-[252px] max-w-[var(--available-width)] rounded-lg border border-slate-200/70 bg-white p-2 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.15),0_2px_6px_-2px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <button
                type="button"
                onClick={() => goToMonth(-1)}
                disabled={isPrevMonthDisabled}
                aria-label={previousMonthLabel}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <span className="text-[13px] font-medium text-slate-900">
                {monthLabelsFull[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={() => goToMonth(1)}
                disabled={isNextMonthDisabled}
                aria-label={nextMonthLabel}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {weekdayLabels.map((label, index) => (
                <div
                  // Sunday/Wednesday repeat visually ("Su"/"We") but each
                  // column position is unique — index is a legitimate key here.
                  key={index}
                  className="flex h-7 items-center justify-center text-[11px] font-medium text-slate-400"
                >
                  {label}
                </div>
              ))}
              {cells.map((parts, index) => {
                if (!parts) return <div key={`blank-${index}`} />

                const isSelected = selected !== null && toComparable(selected) === toComparable(parts)
                const isToday = toComparable(today) === toComparable(parts)
                const isActive = parts.day === activeDay
                const isDisabledDay = isDisabledDate(parts)

                return (
                  <button
                    key={parts.day}
                    type="button"
                    ref={(el) => {
                      if (el) dayButtonRefs.current.set(parts.day, el)
                      else dayButtonRefs.current.delete(parts.day)
                    }}
                    tabIndex={isActive ? 0 : -1}
                    disabled={isDisabledDay}
                    aria-pressed={isSelected}
                    aria-label={`${parts.day} ${monthLabelsFull[parts.month]} ${parts.year}`}
                    onClick={() => selectDate(parts)}
                    onKeyDown={handleDayKeyDown}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md text-[13px] outline-none transition-colors",
                      "hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40",
                      isSelected && "bg-slate-900 font-semibold text-white hover:bg-slate-900",
                      !isSelected && isToday && "font-semibold text-blue-600",
                      !isSelected && !isToday && "text-slate-700",
                      isDisabledDay && "pointer-events-none text-slate-300 hover:bg-transparent"
                    )}
                  >
                    {parts.day}
                  </button>
                )
              })}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
