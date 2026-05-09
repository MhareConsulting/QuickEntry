"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "signingIn" | "err">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const supabaseConfigured =
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) {
      setStatus("err");
      setMessage("Supabase environment variables are not set.");
      return;
    }
    setStatus("signingIn");
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setStatus("err");
      setMessage(error.message);
      return;
    }
    router.refresh();
    router.replace("/");
  }

  return (
    <div className="login-card">
      <h1>QuickEntry</h1>
      <p>Sign in with the email and password set for your account in Supabase.</p>
      {authError === "auth" ? (
        <p className="login-msg">Could not complete sign-in. Try again.</p>
      ) : null}
      {!supabaseConfigured ? (
        <p className="login-msg">
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> on Vercel (or{" "}
          <code>.env.local</code> locally).
        </p>
      ) : null}
      {status === "err" && message ? (
        <p className="login-msg">{message}</p>
      ) : null}
      <form onSubmit={(e) => void handleSubmit(e)}>
        <label className="fl" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="fi"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@company.com"
          disabled={status === "signingIn" || !supabaseConfigured}
        />
        <label className="fl" htmlFor="password" style={{ marginTop: 10 }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          className="fi"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="Your password"
          disabled={status === "signingIn" || !supabaseConfigured}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginTop: 14, width: "100%" }}
          disabled={status === "signingIn" || !supabaseConfigured}
        >
          {status === "signingIn" ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <Suspense
        fallback={
          <div className="login-card">
            <h1>QuickEntry</h1>
            <p>Loading…</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
