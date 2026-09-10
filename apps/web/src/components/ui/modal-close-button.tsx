import { X } from "lucide-react";
import { Hint } from "./tooltip";

export function ModalCloseButton({ onClick, label = "Fechar modal" }: { onClick: () => void; label?: string }) {
  return (
    <Hint label="Fechar">
      <button className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" type="button" onClick={onClick} aria-label={label}><X size={20} /></button>
    </Hint>
  );
}
