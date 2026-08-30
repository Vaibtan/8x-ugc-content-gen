import Link from "next/link";

import { loadBrandKitSettings } from "@/app/app/settings/actions";
import { BrandKitForm } from "@/app/app/settings/brand-kit-form";
import { MobileShell } from "@/components/mobile-shell";

export default async function SettingsPage() {
  const settings = await loadBrandKitSettings();

  return (
    <MobileShell activePath="/app/settings">
      <section className="pt-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          Your brand
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.05em]">
          Make every asset recognisably yours.
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-[var(--muted-foreground)]">
          Set the details your content will carry into carousels, videos, lead
          magnets, and capture pages.
        </p>
      </section>

      {settings.authenticated ? (
        <>
          <section className="mt-6 rounded-3xl bg-[var(--primary)] p-5 text-[var(--primary-foreground)]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">
              Usage meter
            </p>
            <p className="mt-2 text-3xl font-black">
              ${(settings.usageCents / 100).toFixed(2)}
            </p>
            <p className="mt-1 text-sm opacity-80">
              spent on generation so far
            </p>
            {settings.usageCents === 0 ? (
              <p className="mt-4 text-xs leading-5 opacity-70">
                No provider calls have been recorded yet. This meter will update
                as packs are generated.
              </p>
            ) : null}
          </section>
          <BrandKitForm
            initialAssetUrls={{
              headshot: settings.headshotUrl,
              logo: settings.logoUrl,
            }}
            initialBrandKit={settings.brandKit}
          />
        </>
      ) : (
        <section className="mt-7 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <h2 className="font-bold">Sign in to set your brand kit</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            Your colours and private images are attached to your account, then
            carried into every new content asset.
          </p>
          <Link
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)]"
            href="/"
          >
            Go to sign in
          </Link>
        </section>
      )}
    </MobileShell>
  );
}
