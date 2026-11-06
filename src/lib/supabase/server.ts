import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Runs as the signed-in adult via their auth cookies, so RLS applies.
 * Create a new client per request; never share one across requests.
 */
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  // Session data is personal: never prerender or runtime-prefetch it (auth-js also
  // reads the clock, which Cache Components rejects during prerendering).
  await connection();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by the proxy (added with auth in Phase 2).
        }
      },
    },
  });
}
