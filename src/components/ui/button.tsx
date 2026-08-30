import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

export function Button({
  className,
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm hover:opacity-90",
        variant === "outline" &&
          "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]",
        variant === "ghost" &&
          "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
