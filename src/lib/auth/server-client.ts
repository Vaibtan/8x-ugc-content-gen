import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { type Database } from "@/lib/db/database.types";

export type AuthenticatedIdentity = Readonly<{
  userId: string;
  accessToken: string;
}>;

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

/**
 * Validates the cookie-backed identity before server-side code constructs a
 * per-user Effect layer. A client-supplied user id is never trusted.
 */
export const getAuthenticatedIdentity =
  async (): Promise<AuthenticatedIdentity | null> => {
    try {
      const client = await createAuthServerClient();
      const [
        { data: userData, error: userError },
        { data: sessionData, error: sessionError },
      ] = await Promise.all([client.auth.getUser(), client.auth.getSession()]);

      if (
        userError !== null ||
        sessionError !== null ||
        userData.user === null ||
        sessionData.session?.access_token === undefined
      ) {
        return null;
      }

      return {
        userId: userData.user.id,
        accessToken: sessionData.session.access_token,
      };
    } catch {
      return null;
    }
  };
