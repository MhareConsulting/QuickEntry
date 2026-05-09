"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "err">(
    "idle",
  );
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
    setStatus("sending");
    setMessage(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("err");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
    setMessage("Check your email for the sign-in link.");
  }

  return (
    <div className="login-card">
      <h1>QuickEntry</h1>
      <p>Sign in with a magic link. No password required.</p>
      {authError === "auth" ? (
        <p className="login-msg">Sign-in failed. Request a new link.</p>
      ) : null}
      {!supabaseConfigured ? (
        <p className="login-msg">
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
          <code>.env.local</code>.
        </p>
      ) : null}
      {status === "err" && message ? (
        <p className="login-msg">{message}</p>
      ) : null}
      {status === "sent" && message ? (
        <p style={{ fontSize: 12, color: "var(--success-tx)" }}>{message}</p>
      ) : null}
      <form onSubmit={handleSubmit}>
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
          disabled={status === "sending" || !supabaseConfigured}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginTop: 14, width: "100%" }}
          disabled={status === "sending" || !supabaseConfigured}
        >
          {status === "sending" ? "Sending…" : "Email magic link"}
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
