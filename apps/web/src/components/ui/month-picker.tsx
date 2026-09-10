import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";

const months = Array.from({ length: 12 }, (_, index) => {
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2026, index, 1));
  return name.charAt(0).toLocaleUpperCase("pt-BR") + name.slice(1);
});

export function MonthPicker({ value, onChange, compact = false }: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const [year, month] = value.split("-").map(Number);
  const [visibleYear, setVisibleYear] = useState(year);
  const [open, setOpen] = useState(false);
  const [choosingYear, setChoosingYear] = useState(false);
  const firstYear = Math.floor(visibleYear / 12) * 12;

  return <PopoverPrimitive.Root open={open} onOpenChange={(nextOpen) => {
    if (nextOpen) {
      setVisibleYear(year);
      setChoosingYear(false);
    }
    setOpen(nextOpen);
  }}>
    <PopoverPrimitive.Trigger asChild>
      <Button type="button" variant="ghost" className={compact ? "h-8 min-w-0 px-2 text-sm font-semibold text-foreground" : "mt-2 h-10 w-full justify-start gap-2 px-3 font-semibold text-primary"} aria-label={`Escolher mês e ano: ${months[month - 1]} ${year}`}>
        {!compact && <CalendarDays size={18} />}
        {months[month - 1]} {year}
      </Button>
    </PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content align="center" sideOffset={8} aria-label="Escolher mês e ano" className="z-40 w-[292px] rounded-2xl border border-border bg-card p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setVisibleYear(visibleYear - (choosingYear ? 12 : 1))} aria-label={choosingYear ? "Anos anteriores" : "Ano anterior"}><ChevronLeft size={17} /></Button>
          <Button type="button" variant="ghost" className="h-8 text-sm font-semibold" onClick={() => setChoosingYear(!choosingYear)} aria-label={choosingYear ? "Voltar aos meses" : "Escolher ano"}>
            {choosingYear ? `${firstYear} – ${firstYear + 11}` : visibleYear}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setVisibleYear(visibleYear + (choosingYear ? 12 : 1))} aria-label={choosingYear ? "Próximos anos" : "Próximo ano"}><ChevronRight size={17} /></Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {choosingYear ? Array.from({ length: 12 }, (_, index) => firstYear + index).map((optionYear) => (
            <Button key={optionYear} type="button" variant="ghost" aria-pressed={optionYear === year}
              className={cn("h-9 rounded-full text-xs hover:bg-secondary", optionYear === year && "bg-mint text-mint-foreground hover:bg-mint")}
              onClick={() => { setVisibleYear(optionYear); setChoosingYear(false); }}>
              {optionYear}
            </Button>
          )) : months.map((name, index) => <Button
            key={name}
            type="button"
            variant="ghost"
            aria-label={`${name} ${visibleYear}`}
            aria-pressed={year === visibleYear && month === index + 1}
            className={cn("h-9 rounded-full px-1 text-xs font-medium hover:bg-secondary", year === visibleYear && month === index + 1 && "bg-mint text-mint-foreground hover:bg-mint")}
            onClick={() => {
              onChange(`${visibleYear}-${String(index + 1).padStart(2, "0")}`);
              setOpen(false);
            }}
          >{name.slice(0, 3)}.</Button>)}
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}
