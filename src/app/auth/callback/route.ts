import { NextResponse } from "next/server";

import { createClient } from "../../../lib/supabase/server";

// OAuth (PKCE) callback: exchange the code for a session, then hand off to
// the app. The pantry store reacts to the resulting sign-in on the client and
// migrates the anonymous pantry automatically.
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.redirect(new URL("/login", request.url));
}