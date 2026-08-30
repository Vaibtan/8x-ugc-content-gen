import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { type Database } from "@/lib/db/database.types";

const requiredPublicValue = (
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required before an auth session can be read.`);
  }
  return value;
};

/** Cookie-backed client used only for Supabase Auth session handling. */
export async function createAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requiredPublicValue("NEXT_PUBLIC_SUPABASE_URL"),
    requiredPublicValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot mutate cookies. The callback route owns
            // the write path; this preserves read-only session access here.
          }
        },
      },
    },
  );
}

export async function getCurrentSession() {
  const client = await createAuthServerClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new Error(`Unable to read the current session: ${error.message}`);
  }
  return data.session;
}
