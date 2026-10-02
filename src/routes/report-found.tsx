import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORIES, CATEGORY_ICON, type Category } from "@/data/items";
import { useAuth } from "@/hooks/use-auth";
import { createItem } from "@/lib/items";
import { SignInPrompt } from "@/components/sign-in-prompt";

const KEPT_PLACES = [
  "Security office",
  "Admin front desk",
  "Library desk",
  "Student union",
  "Still with me",
];

export const Route = createFileRoute("/report-found")({
  head: () => ({
    meta: [
      { title: "Report a Found Item — CampusFind" },
      {
        name: "description",
        content:
          "Found something on campus? Log it here so its owner can come and collect it.",
      },
      { property: "og:title", content: "Report a Found Item — CampusFind" },
      {
        property: "og:description",
        content:
          "Found something on campus? Log it here so its owner can come and collect it.",
      },
      { name: "twitter:title", content: "Report a Found Item — CampusFind" },
      {
        name: "twitter:description",
        content:
          "Found something on campus? Log it here so its owner can come and collect it.",
      },
    ],
  }),
  component: ReportFoundPage,
});

function StepHeading({
  step,
  title,
  hint,
}: {
  step: number;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-mustard font-display text-lg font-semibold text-ink"
      >
        {step}
      </span>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3.5 text-base outline-none transition-colors placeholder:text-ink/40 focus:border-ink";
const labelClass = "mb-2 block text-sm font-semibold text-ink";

function ReportFoundPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<Category | null>(null);
  const [keptAt, setKeptAt] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!category) {
      setError("Please choose what kind of thing it is in step 1.");
      return;
    }
    const f = new FormData(e.currentTarget);
    const date = String(f.get("date") ?? "");
    const time = String(f.get("time") ?? "");
    const details = String(f.get("details") ?? "").trim();
    const description = [keptAt ? `Being kept at: ${keptAt}.` : "", details]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1000);
    setBusy(true);
    try {
      await createItem({
        kind: "found",
        title: String(f.get("itemName") ?? "").trim().slice(0, 120),
        category,
        location: String(f.get("place") ?? "").trim().slice(0, 160),
        description,
        occurredAt: date ? new Date(`${date}T${time || "12:00"}`).toISOString() : undefined,
        photo: f.get("photo") as File | null,
      });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="px-5 py-24 text-center text-ink/60">Loading…</div>;
  if (!user) return <SignInPrompt next="/report-found" action="report a found item" />;

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="rounded-3xl border-2 border-ink/10 bg-white p-8 text-center sm:p-12">
          <span aria-hidden="true" className="text-5xl">
            🎉
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
            Thank you — that's a good deed on the board
          </h1>
          <p className="mt-3 text-ink/70">
            Your item is now listed under Found Items so its owner can spot it
            and collect it. Thank you for handing it in.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/found"
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
            >
              Browse found items
            </Link>
            <Link
              to="/"
              className="rounded-full border-2 border-ink/15 bg-white px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full bg-board/12 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-board">
        <span aria-hidden="true" className="size-2 rounded-full bg-board" />
        Found item report
      </span>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Report a found item
      </h1>
      <p className="mt-3 max-w-[52ch] text-lg text-ink/70">
        Thank you for picking it up! Four quick steps so the owner can find it.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-10 flex flex-col gap-10 rounded-3xl border-2 border-ink/10 bg-white p-6 sm:p-10"
      >
        <fieldset>
          <StepHeading
            step={1}
            title="What did you find?"
            hint="A short description is enough — “black umbrella” works well."
          />
          <div className="mt-5">
            <label htmlFor="item-name" className={labelClass}>
              Name of the item
            </label>
            <input
              id="item-name"
              name="itemName"
              type="text"
              required
              placeholder="e.g. Black umbrella"
              className={inputClass}
            />
          </div>
          <div className="mt-5">
            <span className={labelClass}>What kind of thing is it?</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(category === c ? null : c)}
                  className={
                    "rounded-full border-2 px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 " +
                    (category === c
                      ? "border-ink bg-ink text-cream"
                      : "border-ink/15 bg-white text-ink/70")
                  }
                >
                  <span aria-hidden="true" className="mr-1.5">
                    {CATEGORY_ICON[c]}
                  </span>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <StepHeading
            step={2}
            title="Where did you find it?"
            hint="The building or spot where you picked it up."
          />
          <div className="mt-5">
            <label htmlFor="place" className={labelClass}>
              Place
            </label>
            <input
              id="place"
              name="place"
              type="text"
              required
              placeholder="e.g. Near the canteen entrance"
              className={inputClass}
            />
          </div>
        </fieldset>

        <fieldset>
          <StepHeading step={3} title="When did you find it?" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="date" className={labelClass}>
                Date
              </label>
              <input id="date" name="date" type="date" className={inputClass} />
            </div>
            <div>
              <label htmlFor="time" className={labelClass}>
                Around what time? (optional)
              </label>
              <input id="time" name="time" type="time" className={inputClass} />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <StepHeading
            step={4}
            title="Where is it being kept?"
            hint="So the owner knows where to go and describe it."
          />
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Kept at">
            {KEPT_PLACES.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={keptAt === p}
                onClick={() => setKeptAt(keptAt === p ? null : p)}
                className={
                  "rounded-full border-2 px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 " +
                  (keptAt === p
                    ? "border-ink bg-ink text-cream"
                    : "border-ink/15 bg-white text-ink/70")
                }
              >
                {p}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <label htmlFor="details" className={labelClass}>
              Extra details (optional)
            </label>
            <textarea
              id="details"
              name="details"
              rows={3}
              placeholder="e.g. It was raining, the umbrella was leaning by the door"
              className={inputClass + " resize-y"}
            />
          </div>
          <div className="mt-5">
            <label htmlFor="photo" className={labelClass}>
              A photo, if you have one (optional)
            </label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/*"
              className="w-full rounded-2xl border-2 border-dashed border-ink/20 bg-cream px-4 py-3 text-sm text-ink/70 file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cream"
            />
          </div>
        </fieldset>

        <div className="rounded-2xl bg-mustard/20 p-4 text-sm text-ink/80">
          <strong className="font-semibold">Privacy tip:</strong> please don't
          open wallets, bags or ID cards. Describe the item from the outside —
          the owner can prove it's theirs when they collect.
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-tomato/12 p-4 text-sm font-medium text-tomato">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-3xl bg-board px-8 py-4 text-lg font-semibold text-cream transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
        >
          {busy ? "Posting…" : "Post it to the board"}
        </button>
      </form>
    </div>
  );
}
