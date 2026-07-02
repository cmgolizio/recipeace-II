import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "../../types/database";

/**
 * Supabase client for use in Client Components (browser).
 * Create a fresh client per use; it reads/writes the session from cookies.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}