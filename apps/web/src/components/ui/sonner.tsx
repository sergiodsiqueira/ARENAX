import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-sans rounded-xl border-border bg-card text-card-foreground shadow-lg",
          title: "font-semibold",
          description: "text-muted-foreground",
          success: "border-primary/15",
          error: "border-destructive/20",
        },
      }}
    />
  );
}
