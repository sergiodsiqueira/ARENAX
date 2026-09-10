import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useId, useRef, type ReactNode } from "react";

import { cn } from "../../lib/utils";

export function FormModal({ children, title, onClose, size = "md" }: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const titleId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/45 backdrop-blur-[1px]" />
        <DialogPrimitive.Content
          aria-labelledby={titleId}
          aria-describedby={undefined}
          onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
          onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus(); }}
          onPointerDownOutside={(event) => event.preventDefault()}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card text-card-foreground shadow-xl focus:outline-none",
            { sm: "max-w-md", md: "max-w-xl", lg: "max-w-2xl", xl: "max-w-5xl" }[size],
          )}
        >
          <DialogPrimitive.Title id={titleId} className="sr-only">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
