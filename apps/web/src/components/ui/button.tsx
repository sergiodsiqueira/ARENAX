import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "ui-button",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs enabled:hover:bg-primary/90",
        destructive: "bg-destructive text-primary-foreground shadow-xs enabled:hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline: "border border-input bg-background shadow-xs enabled:hover:bg-accent enabled:hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs enabled:hover:bg-secondary/80",
        ghost: "enabled:hover:bg-accent enabled:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 enabled:hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({ className, variant, size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button };
