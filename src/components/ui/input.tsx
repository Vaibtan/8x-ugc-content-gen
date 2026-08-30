import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-base outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/20",
        className,
      )}
      {...props}
    />
  );
}
