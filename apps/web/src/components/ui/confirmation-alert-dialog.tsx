import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "./button";

export function ConfirmationAlertDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  pending = false,
  alternativeAction,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  alternativeAction?: { label: string; onSelect: () => void };
}) {
  return (
    <AlertDialogPrimitive.Root>
      <AlertDialogPrimitive.Trigger asChild>{trigger}</AlertDialogPrimitive.Trigger>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border bg-card p-6 text-card-foreground shadow-xl data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <AlertDialogPrimitive.Title className="pr-8 text-lg font-semibold">{title}</AlertDialogPrimitive.Title>
          {alternativeAction && (
            <AlertDialogPrimitive.Cancel asChild>
              <Button type="button" variant="ghost" size="icon" className="absolute right-4 top-4" aria-label="Fechar modal"><X size={20} /></Button>
            </AlertDialogPrimitive.Cancel>
          )}
          <AlertDialogPrimitive.Description className="mt-2 text-sm leading-6 text-muted-foreground">{description}</AlertDialogPrimitive.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {!alternativeAction && <AlertDialogPrimitive.Cancel asChild>
              <Button variant="outline">Voltar</Button>
            </AlertDialogPrimitive.Cancel>}
            <AlertDialogPrimitive.Action asChild>
              <Button variant="destructive" disabled={pending} onClick={onConfirm}>{confirmLabel}</Button>
            </AlertDialogPrimitive.Action>
            {alternativeAction && (
              <AlertDialogPrimitive.Action asChild>
                <Button variant="outline" disabled={pending} onClick={alternativeAction.onSelect}>{alternativeAction.label}</Button>
              </AlertDialogPrimitive.Action>
            )}
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
