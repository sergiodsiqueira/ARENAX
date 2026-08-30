import { ShieldCheck, ShieldEllipsis, ShieldX } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export type StatusCounterKind = "active" | "inactive" | "all";

const styles = {
  active: {
    icon: ShieldCheck,
  },
  inactive: {
    icon: ShieldX,
  },
  all: {
    icon: ShieldEllipsis,
  },
} satisfies Record<
  StatusCounterKind,
  { icon: typeof ShieldCheck }
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
    <Button
      variant="outline"
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-auto min-h-24 w-full justify-start gap-4 rounded-2xl border-transparent px-4 py-3.5 text-left whitespace-normal shadow-none hover:-translate-y-0.5 hover:bg-secondary hover:shadow-sm",
        selected ? "bg-secondary ring-1 ring-primary/5" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "grid size-13 shrink-0 place-items-center rounded-xl text-foreground",
          selected ? "bg-card" : "bg-secondary",
        )}
      >
        <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">
          {label}
        </span>
        <strong className="mt-1 block text-2xl leading-none font-semibold text-primary">
          {value}
        </strong>
      </span>
    </Button>
  );
}
