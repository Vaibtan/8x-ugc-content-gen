import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentSession } from "@/lib/auth/server-client";

import { requestMagicLink, signInWithGoogle } from "./auth/actions";

export default async function LandingPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ checkEmail?: string; authError?: string }>;
}>) {
  const session = await getCurrentSession();
  if (session) redirect("/app");

  const { checkEmail, authError } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center bg-[radial-gradient(circle_at_top_right,_#dbece1,_transparent_35%),var(--background)] px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <p className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          Founder Voice
        </p>
        <h1 className="text-balance text-4xl font-black leading-[0.98] tracking-[-0.055em]">
          Content that still sounds like you.
        </h1>
        <p className="mt-5 text-pretty text-base leading-7 text-[var(--muted-foreground)]">
          Turn your strategy into voice-true content packs and lead magnets,
          built for the few minutes between founder meetings.
        </p>

        <section className="mt-9 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_14px_50px_rgba(23,63,52,0.10)]">
          <h2 className="text-lg font-bold">Start your content engine</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
            Sign in with Google, or use a magic link when you prefer email.
          </p>
          {checkEmail ? (
            <p className="mt-4 rounded-xl bg-[var(--muted)] p-3 text-sm font-medium text-[var(--primary)]">
              Check your inbox for a secure sign-in link.
            </p>
          ) : null}
          {authError ? (
            <p className="mt-4 rounded-xl bg-[#fff1ed] p-3 text-sm font-medium text-[#9d351e]">
              {authError}
            </p>
          ) : null}
          <form action={signInWithGoogle} className="mt-5">
            <Button className="w-full" type="submit">
              Continue with Google
            </Button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)] before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)]">
            or
          </div>
          <form action={requestMagicLink} className="space-y-3">
            <label className="text-sm font-semibold" htmlFor="email">
              Work email
            </label>
            <Input
              autoComplete="email"
              id="email"
              name="email"
              placeholder="you@company.com"
              required
              type="email"
            />
            <Button className="w-full" type="submit" variant="outline">
              Email me a magic link
            </Button>
          </form>
        </section>
        <p className="mt-6 text-center text-xs leading-5 text-[var(--muted-foreground)]">
          By continuing, you agree to build in public. No social accounts are
          connected or automated.{" "}
          <Link className="underline" href="/app">
            Preview the shell
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
