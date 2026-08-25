import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function setDatePart(dateTime: string, date: string) {
  return `${date}T${dateTime.slice(11, 16)}`;
}

function setTimePart(dateTime: string, time: string) {
  return `${dateTime.slice(0, 10)}T${time}`;
}

type SessionSchedulePickerProps = {
  start: string;
  end: string;
  onChange: (period: { start: string; end: string }) => void;
};

function SessionSchedulePicker({ start, end, onChange }: SessionSchedulePickerProps) {
  const selectedDate = start.slice(0, 10);
  const selected = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1, 12),
  );

  const moveMonth = (amount: number) => {
    setVisibleMonth((current) =>
      new Date(current.getFullYear(), current.getMonth() + amount, 1, 12),
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => moveMonth(-1)} aria-label="Mês anterior">
            <ChevronLeft size={18} />
          </Button>
          <p className="font-semibold capitalize text-foreground">
            {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(visibleMonth)}
          </p>
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => moveMonth(1)} aria-label="Próximo mês">
            <ChevronRight size={18} />
          </Button>
        </div>

        <div className="grid grid-cols-7" role="grid" aria-label="Escolher data da Sessão">
          {weekDays.map((label) => (
            <span key={label} className="grid h-9 place-items-center text-xs font-medium text-muted-foreground">{label}</span>
          ))}
          {calendarDays(visibleMonth).map((day) => {
            const itemValue = dateValue(day);
            const isSelected = itemValue === selectedDate;
            const isOutside = day.getMonth() !== visibleMonth.getMonth();
            return (
              <button
                key={itemValue}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                className={cn(
                  "mx-auto grid size-9 place-items-center rounded-full text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isOutside && "text-muted-foreground/55",
                  isSelected && "bg-mint text-mint-foreground hover:bg-mint",
                )}
                onClick={() => {
                  onChange({ start: setDatePart(start, itemValue), end: setDatePart(end, itemValue) });
                  setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1, 12));
                }}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 border-t border-border bg-secondary/25 p-4 sm:grid-cols-2 sm:p-5">
        <label className="text-sm font-semibold text-foreground">
          Horário inicial
          <div className="relative mt-2">
            <Clock3 className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" size={17} />
            <Input className="pl-10" type="time" value={start.slice(11, 16)} onChange={(event) => onChange({ start: setTimePart(start, event.target.value), end })} required />
          </div>
        </label>
        <label className="text-sm font-semibold text-foreground">
          Horário final
          <div className="relative mt-2">
            <Clock3 className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" size={17} />
            <Input className="pl-10" type="time" value={end.slice(11, 16)} onChange={(event) => onChange({ start, end: setTimePart(end, event.target.value) })} required />
          </div>
        </label>
      </div>
    </div>
  );
}

export { SessionSchedulePicker };
