"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitizeNextPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

const PENDING_EMAIL_KEY = "idreammusic:pending-auth-email";
const PENDING_NEXT_KEY = "idreammusic:pending-auth-next";

type AuthStep = "email" | "code";
type AuthStatus = "idle" | "sending" | "sent" | "verifying" | "error";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = useMemo(
    () => sanitizeNextPath(searchParams.get("next"), "/studio"),
    [searchParams],
  );
  const linkError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<AuthStep>("email");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!hasSupabaseEnv()) return;

    const pendingEmail = window.sessionStorage.getItem(PENDING_EMAIL_KEY);
    const pendingNext = window.sessionStorage.getItem(PENDING_NEXT_KEY);

    if (pendingEmail && (!pendingNext || pendingNext === requestedNext)) {
      setEmail(pendingEmail);
      setStep("code");
      setStatus(linkError === "link-expired" ? "error" : "sent");
      setMessage(
        linkError === "link-expired"
          ? "That secure sign-in link could not be completed. Enter the code from the email or request a new code."
          : "Return here after checking your email and enter the six-digit code below.",
      );
    } else if (linkError === "link-expired") {
      setStatus("error");
      setMessage(
        "That secure sign-in link could not be completed. Request a new code and try again.",
      );
    }

    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace(requestedNext);
        router.refresh();
      }
    });
  }, [linkError, requestedNext, router]);

  function rememberPendingSignIn(resolvedEmail: string) {
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, resolvedEmail);
    window.sessionStorage.setItem(PENDING_NEXT_KEY, requestedNext);
  }

  function clearPendingSignIn() {
    window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
    window.sessionStorage.removeItem(PENDING_NEXT_KEY);
  }

  async function sendCode() {
    if (!hasSupabaseEnv()) {
      setStatus("error");
      setMessage("Supabase environment variables are missing in this build.");
      return;
    }

    const resolvedEmail = email.trim().toLowerCase();
    if (!resolvedEmail) {
      setStatus("error");
      setMessage("Enter your email address first.");
      return;
    }

    try {
      setStatus("sending");
      setMessage("");

      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        requestedNext,
      )}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: resolvedEmail,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) throw error;

      rememberPendingSignIn(resolvedEmail);
      setEmail(resolvedEmail);
      setCode("");
      setStep("code");
      setStatus("sent");
      setMessage(
        `We sent a six-digit code to ${resolvedEmail}. Keep this browser open, check your email app, then return here to enter the code.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send your sign-in code.",
      );
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCode();
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      setStatus("error");
      setMessage("Supabase environment variables are missing in this build.");
      return;
    }

    const resolvedEmail = email.trim().toLowerCase();
    const resolvedCode = code.replace(/\D/g, "").slice(0, 6);

    if (resolvedCode.length !== 6) {
      setStatus("error");
      setMessage("Enter the complete six-digit code from your email.");
      return;
    }

    try {
      setStatus("verifying");
      setMessage("");

      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: resolvedEmail,
        token: resolvedCode,
        type: "email",
      });

      if (error) throw error;

      clearPendingSignIn();
      setStatus("sent");
      setMessage("Signed in. Returning you to your work…");
      router.replace(requestedNext);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "That code could not be verified. Request a new code and try again.",
      );
    }
  }

  function useDifferentEmail() {
    clearPendingSignIn();
    setStep("email");
    setCode("");
    setStatus("idle");
    setMessage("");
  }

  return (
    <div className="card formCard">
      <div className="eyebrow">Authentication</div>
      <h1 className="h2">Sign in without losing your place</h1>
      <p className="copy" style={{ maxWidth: 680 }}>
        We will email a six-digit code. Keep this browser open, check your email
        app, then return here and enter the code. The email also includes a
        secure sign-in link as a secondary option.
      </p>

      {step === "email" ? (
        <form className="form-grid" onSubmit={handleEmailSubmit}>
          <label className="full">
            <span className="fieldLabel">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <div className="full button-row">
            <button
              className="button primary"
              type="submit"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending code…" : "Email me a sign-in code"}
            </button>
          </div>
        </form>
      ) : (
        <form className="form-grid" onSubmit={handleCodeSubmit}>
          <div className="full">
            <span className="fieldLabel">Email</span>
            <div className="copy">
              <strong>{email}</strong>
            </div>
          </div>

          <label className="full">
            <span className="fieldLabel">Six-digit sign-in code</span>
            <input
              type="text"
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              style={{
                maxWidth: 260,
                fontSize: "1.5rem",
                letterSpacing: "0.35em",
                fontVariantNumeric: "tabular-nums",
              }}
            />
          </label>

          <div className="full button-row">
            <button
              className="button primary"
              type="submit"
              disabled={status === "verifying"}
            >
              {status === "verifying" ? "Verifying…" : "Verify and continue"}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={status === "sending" || status === "verifying"}
              onClick={() => void sendCode()}
            >
              {status === "sending" ? "Sending…" : "Send a new code"}
            </button>
            <button
              className="textLink"
              type="button"
              onClick={useDifferentEmail}
              disabled={status === "verifying"}
            >
              Use a different email
            </button>
          </div>

          <p className="copy full" style={{ margin: 0 }}>
            Prefer the link? Open the secure sign-in link in the same email. If
            it opens in a different browser, return to this browser and use the
            code to recover the unfinished work stored here.
          </p>
        </form>
      )}

      {message ? (
        <div
          className={`statusMessage ${
            status === "error" ? "statusError" : "statusSuccess"
          }`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
