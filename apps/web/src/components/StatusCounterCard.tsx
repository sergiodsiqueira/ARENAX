import { Check, CheckCheck, X } from "lucide-react";

export type StatusCounterKind = "active" | "inactive" | "all";

const styles = {
  active: {
    card: "border-emerald-100 bg-emerald-100/80",
    circle: "bg-emerald-500",
    selected: "border-emerald-500 ring-2 ring-emerald-500 ring-offset-2",
    icon: Check,
  },
  inactive: {
    card: "border-rose-100 bg-rose-100/80",
    circle: "bg-rose-500",
    selected: "border-rose-500 ring-2 ring-rose-500 ring-offset-2",
    icon: X,
  },
  all: {
    card: "border-blue-100 bg-blue-100/80",
    circle: "bg-blue-500",
    selected: "border-blue-500 ring-2 ring-blue-500 ring-offset-2",
    icon: CheckCheck,
  },
} satisfies Record<
  StatusCounterKind,
  { card: string; circle: string; selected: string; icon: typeof Check }
>;

export function StatusCounterCard({
  kind,
  label,
  value,
  selected,
  onClick,
}: {
  kind: StatusCounterKind;
  label: string;
  value: number;
  selected: boolean;
  onClick: () => void;
}) {
  const style = styles[kind];
  const Icon = style.icon;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-32 items-center justify-between rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none ${style.card} ${selected ? style.selected : "focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"}`}
    >
      <span>
        <span className="block text-sm font-medium text-slate-600">
          {label}
        </span>
        <strong className="mt-2 block text-3xl font-semibold text-slate-950">
          {value}
        </strong>
      </span>
      <span
        className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-white shadow-sm ${style.circle}`}
      >
        <Icon size={27} strokeWidth={2.5} aria-hidden="true" />
      </span>
    </button>
  );
}
