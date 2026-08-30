import { Search } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

type SearchInputProps = Omit<ComponentProps<"input">, "type">;

function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative w-full max-w-72", className)}>
      <input
        type="search"
        className="h-12 w-full rounded-full border border-transparent bg-slate-50 px-5 pr-12 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:bg-slate-100 focus:border-primary/30 focus:bg-white focus:ring-4 focus:ring-primary/10"
        {...props}
      />
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
        size={20}
        strokeWidth={1.8}
      />
    </div>
  );
}

export { SearchInput };
