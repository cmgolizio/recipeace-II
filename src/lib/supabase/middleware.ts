import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "../../types/database";

/**
 * Refreshes the Supabase auth session on every request and writes any rotated
 * tokens back to the response cookies. Called from `src/proxy.ts`.
 *
 * Do not insert logic between `createServerClient` and `getUser()` — a missed
 * refresh here causes hard-to-debug random logouts.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
          // Auth responses must never be cached by a CDN/proxy, otherwise one
          // user's session token can be served to another.
          for (const [key, value] of Object.entries(headers ?? {})) {
            supabaseResponse.headers.set(key, value);
          }
        },
      },
    },
  );

  // IMPORTANT: refresh the token. getUser() revalidates against the Auth server.
  await supabase.auth.getUser();

  return supabaseResponse;
}