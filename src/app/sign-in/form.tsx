"use client";

import { useState } from "react";

type State =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "verifying" }
  | { status: "error"; error: string };

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Failed" }));
        setState({ status: "error", error: j.error ?? `HTTP ${res.status}` });
        return;
      }
      setState({ status: "sent" });
    } catch (err) {
      setState({ status: "error", error: err instanceof Error ? err.message : "Failed" });
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setState({ status: "error", error: "Enter the 6-digit code." });
      return;
    }
    setState({ status: "verifying" });
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Failed" }));
        setState({ status: "error", error: j.error ?? `HTTP ${res.status}` });
        return;
      }
      window.location.assign("/");
    } catch (err) {
      setState({ status: "error", error: err instanceof Error ? err.message : "Failed" });
    }
  }

  const sentOrVerifying = state.status === "sent" || state.status === "verifying";
  const errorWhileVerifying =
    state.status === "error" && code.length > 0;

  if (sentOrVerifying || errorWhileVerifying) {
    return (
      <form onSubmit={verifyCode} className="space-y-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          We sent a code to <strong>{email}</strong>. Enter it below or click
          the link in the email.
        </p>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-center text-lg tracking-[0.3em] font-mono outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
        />
        <button
          type="submit"
          disabled={state.status === "verifying" || code.length !== 6}
          className="w-full rounded-md bg-brand text-black px-4 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
        >
          {state.status === "verifying" ? "Verifying…" : "Sign in"}
        </button>
        {state.status === "error" && (
          <div className="text-sm text-red-600">{state.error}</div>
        )}
        <button
          type="button"
          onClick={() => {
            setCode("");
            setState({ status: "idle" });
          }}
          className="w-full text-xs text-neutral-500 hover:underline"
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-3">
      <input
        type="email"
        required
        autoFocus
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
      />
      <button
        type="submit"
        disabled={state.status === "sending" || !email}
        className="w-full rounded-md bg-brand text-black px-4 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
      >
        {state.status === "sending" ? "Sending…" : "Email me a code"}
      </button>
      {state.status === "error" && (
        <div className="text-sm text-red-600">{state.error}</div>
      )}
    </form>
  );
}
