import { Clock3 } from "lucide-react";

import { DatePicker } from "./date-picker";
import { Input } from "./input";

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
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
      <label className="min-w-0 text-sm font-semibold text-foreground">
        Data
        <div className="mt-2 flex h-9 items-center rounded-md border border-input bg-transparent shadow-xs">
          <DatePicker
            className="w-full"
            triggerClassName="h-9 w-full justify-start overflow-hidden px-3 text-left"
            value={start.slice(0, 10)}
            onChange={(date) => onChange({
              start: setDatePart(start, date),
              end: setDatePart(end, date),
            })}
          />
        </div>
      </label>

      <label className="text-sm font-semibold text-foreground">
        Horário inicial
        <div className="relative mt-2">
          <Clock3 className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input className="pl-9" type="time" value={start.slice(11, 16)} onChange={(event) => onChange({ start: setTimePart(start, event.target.value), end })} required />
        </div>
      </label>

      <label className="text-sm font-semibold text-foreground">
        Horário final
        <div className="relative mt-2">
          <Clock3 className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input className="pl-9" type="time" value={end.slice(11, 16)} onChange={(event) => onChange({ start, end: setTimePart(end, event.target.value) })} required />
        </div>
      </label>
    </div>
  );
}

export { SessionSchedulePicker };
