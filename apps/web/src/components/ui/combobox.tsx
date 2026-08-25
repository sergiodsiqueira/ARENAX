import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useState } from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";

export type ComboboxOption = { value: string; label: string };

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhuma opção encontrada.",
  disabled = false,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("mt-2 w-full justify-between bg-card font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-[70] w-[var(--radix-popover-trigger-width)] rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <CommandPrimitive className="overflow-hidden rounded-lg bg-popover">
            <div className="flex items-center gap-2 border-b px-3" cmdk-input-wrapper="">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <CommandPrimitive.Input className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder={searchPlaceholder} />
            </div>
            <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
              <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">{emptyText}</CommandPrimitive.Empty>
              {options.map((option) => (
                <CommandPrimitive.Item
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <Check className={cn("size-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option.label}</span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
