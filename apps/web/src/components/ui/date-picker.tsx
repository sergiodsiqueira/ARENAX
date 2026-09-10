import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import { MonthPicker } from "./month-picker";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function DatePicker({
  value,
  onChange,
  markedDates = new Set<string>(),
  className,
  triggerClassName,
  inline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  markedDates?: ReadonlySet<string>;
  className?: string;
  triggerClassName?: string;
  inline?: boolean;
}) {
  const selected = useMemo(() => parseDate(value), [value]);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1, 12),
  );
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const displayedMonth = inline ? selected : visibleMonth;

  useEffect(() => {
    if (inline) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") setOpen(false);
      if (event instanceof MouseEvent && !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [inline]);

  const moveMonth = (amount: number) => {
    if (inline) {
      const nextMonth = new Date(selected.getFullYear(), selected.getMonth() + amount, 1, 12);
      const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
      nextMonth.setDate(Math.min(selected.getDate(), lastDay));
      onChange(dateValue(nextMonth));
      return;
    }
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1, 12));
  };

  return (
    <div className={cn("relative", className)} ref={root}>
      {!inline && <Button
        type="button"
        variant="ghost"
        className={cn("h-10 gap-2 px-3 font-semibold text-primary", triggerClassName)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarDays size={18} />
        {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(selected)}
      </Button>}

      {(inline || open) && (
        <div className={inline ? "w-full" : "absolute top-full left-1/2 z-40 mt-2 w-[292px] -translate-x-1/2 rounded-2xl border border-border bg-card p-4 shadow-xl"} role={inline ? "group" : "dialog"} aria-label="Escolher data">
          <div className="mb-3 flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => moveMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={17} /></Button>
            {inline ? <MonthPicker compact value={value.slice(0, 7)} onChange={(monthValue) => {
              const nextMonth = parseDate(`${monthValue}-01`);
              const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
              nextMonth.setDate(Math.min(selected.getDate(), lastDay));
              onChange(dateValue(nextMonth));
            }} /> : <p className="text-sm font-semibold capitalize text-foreground">
              {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(displayedMonth)}
            </p>}
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => moveMonth(1)} aria-label="Próximo mês"><ChevronRight size={17} /></Button>
          </div>

          <div className="grid grid-cols-7" role="grid">
            {weekDays.map((label) => <span key={label} className="grid h-8 place-items-center text-[.68rem] font-medium text-muted-foreground">{label}</span>)}
            {calendarDays(displayedMonth).map((day) => {
              const itemValue = dateValue(day);
              const isSelected = itemValue === value;
              const isOutside = day.getMonth() !== displayedMonth.getMonth();
              const isMarked = markedDates.has(itemValue);
              return (
                <button
                  key={itemValue}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  className={cn(
                    "relative mx-auto grid size-9 place-items-center rounded-full text-xs font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    inline && "h-auto w-full max-w-9 aspect-square",
                    isOutside && "text-muted-foreground/55",
                    isSelected && "bg-mint text-mint-foreground hover:bg-mint",
                  )}
                  onClick={() => {
                    onChange(itemValue);
                    setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1, 12));
                    setOpen(false);
                  }}
                >
                  {day.getDate()}
                  {isMarked && !isSelected && <span className="absolute bottom-0.5 h-0.5 w-3 rounded-full bg-mint" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
