import { Search } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

type SearchInputProps = Omit<ComponentProps<"input">, "type">;

function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative w-full max-w-72", className)}>
      <input
        type="search"
        className="h-12 w-full rounded-full border border-transparent bg-muted px-5 pr-12 text-sm text-foreground outline-none transition placeholder:text-muted-foreground hover:bg-muted focus:border-primary/30 focus:bg-card focus:ring-4 focus:ring-primary/10"
        {...props}
      />
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        size={20}
        strokeWidth={1.8}
      />
    </div>
  );
}

export { SearchInput };
