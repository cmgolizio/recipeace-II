import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

// Next.js 16 renamed the `middleware` convention to `proxy` (runs on the
// Node.js runtime by default). This keeps the Supabase auth session fresh.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every request path except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico and common image assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};