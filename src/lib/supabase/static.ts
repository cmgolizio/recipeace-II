import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database";

/**
 * Cookie-free Supabase client for static contexts — generateStaticParams,
 * the sitemap, and statically rendered pages — where the cookie-bound server
 * client would force dynamic rendering. Only for world-readable data.
 *
 * Returns null when the Supabase env vars are absent (e.g. the env-less CI
 * build) so callers can skip build-time prerendering gracefully.
 */
export function createStaticClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}