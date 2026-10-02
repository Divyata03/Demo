import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORIES, COMMON_PLACES, CATEGORY_ICON, type Category } from "@/data/items";
import { useAuth } from "@/hooks/use-auth";
import { createItem } from "@/lib/items";
import { SignInPrompt } from "@/components/sign-in-prompt";

export const Route = createFileRoute("/report-lost")({
  head: () => ({
    meta: [
      { title: "Report a Lost Item — CampusFind" },
      {
        name: "description",
        content:
          "Tell the campus what you lost and where. Four easy steps with your college account.",
      },
      { property: "og:title", content: "Report a Lost Item — CampusFind" },
      {
        property: "og:description",
        content:
          "Tell the campus what you lost and where. Four easy steps with your college account.",
      },
      { name: "twitter:title", content: "Report a Lost Item — CampusFind" },
      {
        name: "twitter:description",
        content:
          "Tell the campus what you lost and where. Four easy steps with your college account.",
      },
    ],
  }),
  component: ReportLostPage,
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

function ReportLostPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<Category | null>(null);
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
    setBusy(true);
    try {
      await createItem({
        kind: "lost",
        title: String(f.get("itemName") ?? "").trim().slice(0, 120),
        category,
        location: String(f.get("place") ?? "").trim().slice(0, 160),
        description: String(f.get("details") ?? "").trim().slice(0, 1000),
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
  if (!user) return <SignInPrompt next="/report-lost" action="report a lost item" />;

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="rounded-3xl border-2 border-ink/10 bg-white p-8 text-center sm:p-12">
          <span aria-hidden="true" className="text-5xl">
            📌
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
            Your item is now on the board
          </h1>
          <p className="mt-3 text-ink/70">
            It's listed under Lost Items so anyone who finds it can match it
            with you. Keep an eye on the Found Items page too.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/lost"
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
            >
              Browse lost items
            </Link>
            <Link
              to="/found"
              className="rounded-full border-2 border-ink/15 bg-white px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
            >
              Check found items
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full bg-tomato/12 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-tomato">
        <span aria-hidden="true" className="size-2 rounded-full bg-tomato" />
        Lost item report
      </span>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Report a lost item
      </h1>
      <p className="mt-3 max-w-[52ch] text-lg text-ink/70">
        Four easy steps. Fill in what you can — every detail helps someone
        recognise it.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-10 flex flex-col gap-10 rounded-3xl border-2 border-ink/10 bg-white p-6 sm:p-10"
      >
        <fieldset>
          <StepHeading
            step={1}
            title="What did you lose?"
            hint="A short description is enough — “blue water bottle” works well."
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
              placeholder="e.g. Blue water bottle"
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
            title="Where did you last have it?"
            hint="A building or a rough area is fine."
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
              placeholder="e.g. Library, second floor"
              className={inputClass}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {COMMON_PLACES.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-mustard/30 px-3 py-1 text-xs font-medium text-ink"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <StepHeading
            step={3}
            title="When did you notice it was missing?"
          />
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
            title="Anything else we should know?"
            hint="A colour, a sticker, a scratch — small things help us match it."
          />
          <div className="mt-5">
            <label htmlFor="details" className={labelClass}>
              Extra details (optional)
            </label>
            <textarea
              id="details"
              name="details"
              rows={4}
              placeholder="e.g. It has a small dent on the lid"
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
          write phone numbers, ID numbers or hostel room numbers in your
          description. The office will verify it's yours when you collect.
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-tomato/12 p-4 text-sm font-medium text-tomato">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-3xl bg-tomato px-8 py-4 text-lg font-semibold text-cream transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
        >
          {busy ? "Posting…" : "Post it to the board"}
        </button>
      </form>
    </div>
  );
}
