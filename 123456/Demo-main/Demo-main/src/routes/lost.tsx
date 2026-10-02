import { Link, createFileRoute } from "@tanstack/react-router";
import { ItemCard } from "@/components/item-card";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CATEGORIES } from "@/data/items";
import { fetchItems } from "@/lib/items";

type LostSearch = {
  cat?: string | undefined;
  q?: string | undefined;
  loc?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  status?: "open" | "claimed" | "returned" | undefined;
};

export const Route = createFileRoute("/lost")({
  validateSearch: (search: Record<string, unknown>): LostSearch => ({
    cat: typeof search["cat"] === "string" ? search["cat"] : undefined,
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    loc: typeof search["loc"] === "string" ? search["loc"] : undefined,
    from: typeof search["from"] === "string" ? search["from"] : undefined,
    to: typeof search["to"] === "string" ? search["to"] : undefined,
    status: ["open", "claimed", "returned"].includes(String(search["status"]))
      ? (search["status"] as LostSearch["status"])
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Lost Items — CampusFind" },
      {
        name: "description",
        content:
          "Browse everything reported lost on campus. See if your missing item is already on the board.",
      },
      { property: "og:title", content: "Lost Items — CampusFind" },
      {
        property: "og:description",
        content:
          "Browse everything reported lost on campus. See if your missing item is already on the board.",
      },
      { name: "twitter:title", content: "Lost Items — CampusFind" },
      {
        name: "twitter:description",
        content:
          "Browse everything reported lost on campus. See if your missing item is already on the board.",
      },
    ],
  }),
  component: LostItemsPage,
});

function LostItemsPage() {
  const { cat, q, loc, from, to, status } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [text, setText] = useState(q ?? "");

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["items", "lost", cat ?? "", q ?? "", loc ?? "", from ?? "", to ?? "", status ?? ""],
    queryFn: () =>
      fetchItems({
        kind: "lost",
        category: cat,
        search: q,
        location: loc,
        fromDate: from,
        toDate: to,
        itemStatus: status,
      }),
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-tomato/12 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-tomato">
            <span aria-hidden="true" className="size-2 rounded-full bg-tomato" />
            Lost · {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Lost items
          </h1>
          <p className="mt-3 max-w-[52ch] text-lg text-ink/70">
            Everything people have reported missing around campus. Spot something of yours? Come to
            the security office with a description to claim it.
          </p>
        </div>
        <Link
          to="/report-lost"
          className="rounded-full bg-tomato px-6 py-3 text-base font-semibold text-cream transition-transform hover:-translate-y-0.5"
        >
          + Report lost
        </Link>
      </div>

      <form
        className="mt-8 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: { cat, q: text.trim() || undefined, loc, from, to, status } });
        }}
      >
        <label htmlFor="board-search" className="sr-only">
          Search items
        </label>
        <div className="flex flex-1 items-center gap-3 rounded-3xl border-2 border-ink bg-white px-5 py-3.5">
          <span aria-hidden="true" className="text-xl leading-none text-ink/40">
            🔍
          </span>
          <input
            id="board-search"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search by name, place or description"
            className="w-full bg-transparent text-base outline-none placeholder:text-ink/40"
          />
        </div>
        <button
          type="submit"
          className="rounded-3xl bg-ink px-7 py-3.5 text-base font-semibold text-cream transition-transform hover:-translate-y-0.5"
        >
          Search
        </button>
      </form>

      {/* Category filter chips */}
      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <button
          type="button"
          onClick={() => navigate({ search: { q, loc, from, to, status } })}
          className={
            "rounded-full border-2 px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 " +
            (!cat ? "border-ink bg-ink text-cream" : "border-ink/15 bg-white text-ink/70")
          }
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() =>
              navigate({
                search:
                  cat === c ? { q, loc, from, to, status } : { cat: c, q, loc, from, to, status },
              })
            }
            className={
              "rounded-full border-2 px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 " +
              (cat === c ? "border-ink bg-ink text-cream" : "border-ink/15 bg-white text-ink/70")
            }
          >
            {c}
          </button>
        ))}
      </div>

      <form
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          navigate({
            search: {
              cat,
              q,
              loc: String(f.get("location") ?? "").trim() || undefined,
              from: String(f.get("from") ?? "") || undefined,
              to: String(f.get("to") ?? "") || undefined,
              status: (String(f.get("status") ?? "") || undefined) as LostSearch["status"],
            },
          });
        }}
      >
        <label className="sr-only" htmlFor="lost-location-filter">
          Filter by location
        </label>
        <input
          id="lost-location-filter"
          name="location"
          defaultValue={loc ?? ""}
          placeholder="Filter by location"
          className="rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
        />
        <label className="sr-only" htmlFor="lost-from-filter">
          From date
        </label>
        <input
          id="lost-from-filter"
          name="from"
          type="date"
          defaultValue={from ?? ""}
          className="rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
        />
        <label className="sr-only" htmlFor="lost-to-filter">
          To date
        </label>
        <input
          id="lost-to-filter"
          name="to"
          type="date"
          defaultValue={to ?? ""}
          className="rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
        />
        <label className="sr-only" htmlFor="lost-status-filter">
          Filter by status
        </label>
        <select
          id="lost-status-filter"
          name="status"
          defaultValue={status ?? ""}
          className="rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
        >
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="claimed">Claim in progress</option>
          <option value="returned">Returned</option>
        </select>
        <button
          type="submit"
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
        >
          Apply
        </button>
      </form>

      {isLoading ? (
        <p className="mt-8 text-center text-ink/60">Loading the board…</p>
      ) : isError ? (
        <p
          role="alert"
          className="mt-8 rounded-3xl bg-tomato/12 p-6 text-center font-medium text-tomato"
        >
          We couldn't load the board right now. Please refresh the page.
        </p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-3xl border-2 border-dashed border-ink/15 bg-white/60 p-10 text-center">
          <p className="font-display text-xl font-semibold">No lost items match yet</p>
          <p className="mt-2 text-ink/60">
            Lost something yourself? Report it so others can look out for it.
          </p>
          <Link
            to="/report-lost"
            className="mt-5 inline-block rounded-full bg-tomato px-6 py-3 text-sm font-semibold text-cream"
          >
            + Report lost
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
