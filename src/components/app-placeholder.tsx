import { MobileShell } from "@/components/mobile-shell";

export function AppPlaceholder({
  activePath,
  eyebrow,
  title,
  description,
}: Readonly<{
  activePath: string;
  eyebrow: string;
  title: string;
  description: string;
}>) {
  return (
    <MobileShell activePath={activePath}>
      <section className="pt-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.05em]">{title}</h1>
        <p className="mt-4 max-w-md text-base leading-7 text-[var(--muted-foreground)]">
          {description}
        </p>
      </section>
      <div className="mt-8 h-32 animate-pulse rounded-3xl bg-[var(--muted)]" />
      <div className="mt-3 h-20 animate-pulse rounded-3xl bg-[var(--muted)]" />
    </MobileShell>
  );
}
