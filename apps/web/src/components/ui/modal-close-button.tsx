import { X } from "lucide-react";

export function ModalCloseButton({ onClick, label = "Fechar modal" }: { onClick: () => void; label?: string }) {
  return <button className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" type="button" onClick={onClick} aria-label={label} title="Fechar"><X size={20} /></button>;
}
