"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "../lib/supabase/client";

export function AuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: "login" | "signup") {
    setPending(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setPending(false);
        return;
      }
      if (!data.session) {
        // Email confirmation is enabled on the project.
        setMessage("Check your email to confirm your account, then log in.");
        setPending(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setPending(false);
        return;
      }
    }

    // Signed in. The pantry store reacts to the auth change and migrates the
    // anonymous pantry into the account.
    router.push("/");
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run("login");
      }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium opacity-80">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="password"
          className="block text-sm font-medium opacity-80"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          minLength={6}
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && (
        <p className="text-sm text-green-700 dark:text-green-400">{message}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          Log in
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void run("signup")}
          className="flex-1 rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/[0.06]"
        >
          Sign up
        </button>
      </div>
    </form>
  );
}