import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

/** Supabase client for Client Components. Runs as the signed-in adult (RLS applies). */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
