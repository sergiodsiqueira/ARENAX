import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown, Pencil, Search } from "lucide-react";
import { type ReactNode, useState } from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";

const normalizeSearchText = (text: string) => text
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR");

export type ComboboxOption = {
  value: string;
  label: string;
  detail?: string;
  detailIcon?: ReactNode;
};

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhuma opção encontrada.",
  disabled = false,
  className,
  onOptionEdit,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  onOptionEdit?: (value: string) => void;
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
          <CommandPrimitive
            className="overflow-hidden rounded-lg bg-popover"
            filter={(optionText, search) => normalizeSearchText(optionText).includes(normalizeSearchText(search)) ? 1 : 0}
          >
            <div className="flex items-center gap-2 border-b px-3" cmdk-input-wrapper="">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <CommandPrimitive.Input className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder={searchPlaceholder} />
            </div>
            <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
              <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">{emptyText}</CommandPrimitive.Empty>
              {options.map((option) => (
                <CommandPrimitive.Item
                  key={option.value}
                  value={`${option.label} ${option.detail ?? ""} ${option.value}`}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <Check className={cn("size-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                    {option.detail && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                        {option.detailIcon}
                        {option.detail}
                      </span>
                    )}
                  </span>
                  {onOptionEdit && (
                    <button
                      type="button"
                      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Editar ${option.label}`}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpen(false);
                        onOptionEdit(option.value);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
