import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PROFILE_TYPE_LABEL, type ProfileUserType } from "@/lib/items";

type AuthSearch = { mode?: "signin" | "signup" | undefined; next?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    mode: s["mode"] === "signup" ? "signup" : "signin",
    next:
      typeof s["next"] === "string" && s["next"].startsWith("/") && !s["next"].startsWith("//")
        ? s["next"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — CampusFind" },
      {
        name: "description",
        content: "Sign in or create a CampusFind account with your college email.",
      },
      { property: "og:title", content: "Sign in — CampusFind" },
      {
        property: "og:description",
        content: "Sign in or create a CampusFind account with your college email.",
      },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3.5 text-base outline-none transition-colors placeholder:text-ink/40 focus:border-ink";
const labelClass = "mb-2 block text-sm font-semibold text-ink";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().email("Please enter a valid college email").max(255),
  password: z.string().min(8, "Password needs at least 8 characters").max(72),
  userType: z.enum(["student", "teacher", "cleaner", "other_staff"]),
});

function AuthPage() {
  const { mode = "signin", next } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  useEffect(() => {
    if (user) navigate({ to: next ?? "/", replace: true });
  }, [user, next, navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (isSignup) {
        const parsed = signupSchema.safeParse({
          fullName: f.get("fullName"),
          email: f.get("email"),
          password: f.get("password"),
          userType: f.get("userType"),
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Please check the form");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            data: {
              full_name: parsed.data.fullName,
              user_type: parsed.data.userType,
              campus_role:
                parsed.data.userType === "cleaner" ? "cleaning_staff" : parsed.data.userType,
            },
          },
        });
        if (error) setError(error.message);
        else if (!data.session)
          setInfo(
            "Almost done! We sent a link to your college email. Open it to confirm your account, then sign in.",
          );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: String(f.get("email") ?? "").trim(),
          password: String(f.get("password") ?? ""),
        });
        if (error) setError("That email and password don't match. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-12 sm:py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-3 text-lg text-ink/70">
        {isSignup
          ? "Use your college email. It takes less than a minute."
          : "Sign in with your college email to post on the board."}
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 flex flex-col gap-5 rounded-3xl border-2 border-ink/10 bg-white p-6 sm:p-8"
      >
        {isSignup && (
          <div>
            <label htmlFor="fullName" className={labelClass}>
              Your name
            </label>
            <input
              id="fullName"
              name="fullName"
              required
              autoComplete="name"
              placeholder="e.g. Asha"
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-ink/55">
              Only your first name is shown on the board.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="email" className={labelClass}>
            College email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@college.edu"
            className={inputClass}
          />
          {isSignup && (
            <p className="mt-1.5 text-xs text-ink/55">Never shown to anyone on the board.</p>
          )}
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className={inputClass}
          />
        </div>
        {isSignup && (
          <div>
            <label htmlFor="userType" className={labelClass}>
              User Type
            </label>
            <select id="userType" name="userType" defaultValue="student" className={inputClass}>
              {(Object.keys(PROFILE_TYPE_LABEL) as ProfileUserType[]).map((type) => (
                <option key={type} value={type}>
                  {PROFILE_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-2xl bg-tomato/12 p-3 text-sm font-medium text-tomato">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="rounded-2xl bg-mustard/30 p-3 text-sm font-medium text-ink">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-3xl bg-ink px-8 py-4 text-lg font-semibold text-cream transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-ink/70">
        {isSignup ? "Already have an account? " : "New to CampusFind? "}
        <Link
          to="/auth"
          search={{ mode: isSignup ? "signin" : "signup", next }}
          className="font-semibold text-tomato underline decoration-2 underline-offset-4"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
