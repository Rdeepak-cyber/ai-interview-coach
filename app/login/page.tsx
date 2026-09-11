"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const result = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      if (isSignUp) {
        setMessage("Account created. Check your email to confirm your address, then sign in.");
        setIsSignUp(false);
        setPassword("");
      } else {
        window.location.assign("/");
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="auth-title">
        <div className="auth-brand">
          <div className="brand-logo" aria-hidden="true">AI</div>
          <div>
            <span className="brand-title">Interview Coach</span>
            <span className="brand-subtitle">Personalized AI Practice</span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-heading">
            <p className="hero-kicker"><span className="hero-kicker-line" /> PRIVATE PRACTICE SPACE</p>
            <h1 id="auth-title">{isSignUp ? "Create your account." : "Welcome back."}</h1>
            <p className="auth-intro">
              {isSignUp
                ? "Save your interview progress and revisit your feedback whenever you need it."
                : "Sign in to continue your personalized interview practice."}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSignUp ? "new-password" : "current-password"} minLength={6} required />
            {error && <p className="auth-message auth-error" role="alert">{error}</p>}
            {message && <p className="auth-message auth-success" role="status">{message}</p>}
            <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="auth-switch">
            {isSignUp ? "Already have an account?" : "New to Interview Coach?"}{" "}
            <button type="button" className="text-action-btn" onClick={() => { setIsSignUp((current) => !current); setError(null); setMessage(null); }}>
              {isSignUp ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
