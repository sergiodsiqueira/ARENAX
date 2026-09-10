import { type SetStateAction } from "react";
import { useSearchParams } from "react-router";

export function useUrlFilter<T extends string>(
  key: string,
  fallback: T,
  isValid: (value: string) => boolean = Boolean,
): [T, (next: SetStateAction<T>) => void] {
  const [params, setParams] = useSearchParams();
  const requested = params.get(key);
  const value = requested !== null && isValid(requested) ? requested as T : fallback;
  const setValue = (next: SetStateAction<T>) => {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      const previous = current.get(key);
      const resolved = previous !== null && isValid(previous) ? previous as T : fallback;
      updated.set(key, typeof next === "function" ? next(resolved) : next);
      return updated;
    }, { replace: true });
  };
  return [value, setValue];
}
