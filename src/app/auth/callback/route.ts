import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { type Database } from "@/lib/db/database.types";
import { runApp, verifyRuntimeConfiguration } from "@/lib/runtime";

const publicConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase public configuration is missing. Copy .env.example to .env.local.",
    );
  }
  return { url, key };
};

/** Completes Google OAuth and magic-link PKCE exchanges, then sets session cookies. */
export async function GET(request: NextRequest) {
  // Deliberately resolve the same app runtime used by actions and API routes.
  // This also gives a clear boot failure when a required server secret is absent.
  await runApp(verifyRuntimeConfiguration);

  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL(code ? "/app" : "/", request.url);
  if (!code)
    destination.searchParams.set("authError", "Missing%20auth%20code.");

  const response = NextResponse.redirect(destination);
  if (!code) return response;

  const { url, key } = publicConfig();
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const failed = NextResponse.redirect(new URL("/", request.url));
    failed.cookies.set("fv-auth-error", error.message, {
      maxAge: 60,
      path: "/",
    });
    return failed;
  }

  return response;
}
