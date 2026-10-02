import { Link } from "@tanstack/react-router";

export function SignInPrompt({ next, action }: { next: string; action: string }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="rounded-3xl border-2 border-ink/10 bg-white p-8 text-center sm:p-12">
        <span aria-hidden="true" className="text-5xl">🔐</span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
          Please sign in to {action}
        </h1>
        <p className="mt-3 text-ink/70">
          Use your college email. This keeps the board safe and only for people
          on campus. Your email is never shown to others.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "signin", next }}
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup", next }}
            className="rounded-full border-2 border-ink/15 bg-white px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
