import { Link, createFileRoute } from "@tanstack/react-router";
import { ItemCard } from "@/components/item-card";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CATEGORIES } from "@/data/items";
import { fetchItems } from "@/lib/items";

type FoundSearch = {
  cat?: string | undefined;
  q?: string | undefined;
  loc?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  status?: "open" | "claimed" | "returned" | undefined;
};

export const Route = createFileRoute("/found")({
  validateSearch: (search: Record<string, unknown>): FoundSearch => ({
    cat: typeof search["cat"] === "string" ? search["cat"] : undefined,
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    loc: typeof search["loc"] === "string" ? search["loc"] : undefined,
    from: typeof search["from"] === "string" ? search["from"] : undefined,
    to: typeof search["to"] === "string" ? search["to"] : undefined,
    status: ["open", "claimed", "returned"].includes(String(search["status"]))
      ? (search["status"] as FoundSearch["status"])
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Found Items — CampusFind" },
      {
        name: "description",
        content:
          "Browse everything handed in on campus. Someone may have already found what you're missing.",
      },
      { property: "og:title", content: "Found Items — CampusFind" },
      {
        property: "og:description",
        content:
          "Browse everything handed in on campus. Someone may have already found what you're missing.",
      },
      { name: "twitter:title", content: "Found Items — CampusFind" },
      {
        name: "twitter:description",
        content:
          "Browse everything handed in on campus. Someone may have already found what you're missing.",
      },
    ],
  }),
  component: FoundItemsPage,
});

function FoundItemsPage() {
  const { cat, q, loc, from, to, status } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [text, setText] = useState(q ?? "");

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["items", "found", cat ?? "", q ?? "", loc ?? "", from ?? "", to ?? "", status ?? ""],
    queryFn: () =>
      fetchItems({
        kind: "found",
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
          <span className="inline-flex items-center gap-2 rounded-full bg-board/12 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-board">
            <span aria-hidden="true" className="size-2 rounded-full bg-board" />
            Found · {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Found items
          </h1>
          <p className="mt-3 max-w-[52ch] text-lg text-ink/70">
            Everything kind people have picked up and handed in. If you see yours, describe it to
            the office where it's kept and take it home.
          </p>
        </div>
        <Link
          to="/report-found"
          className="rounded-full bg-board px-6 py-3 text-base font-semibold text-cream transition-transform hover:-translate-y-0.5"
        >
          + Report found
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
              status: (String(f.get("status") ?? "") || undefined) as FoundSearch["status"],
            },
          });
        }}
      >
        <label className="sr-only" htmlFor="found-location-filter">
          Filter by location
        </label>
        <input
          id="found-location-filter"
          name="location"
          defaultValue={loc ?? ""}
          placeholder="Filter by location"
          className="rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
        />
        <label className="sr-only" htmlFor="found-from-filter">
          From date
        </label>
        <input
          id="found-from-filter"
          name="from"
          type="date"
          defaultValue={from ?? ""}
          className="rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
        />
        <label className="sr-only" htmlFor="found-to-filter">
          To date
        </label>
        <input
          id="found-to-filter"
          name="to"
          type="date"
          defaultValue={to ?? ""}
          className="rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
        />
        <label className="sr-only" htmlFor="found-status-filter">
          Filter by status
        </label>
        <select
          id="found-status-filter"
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
          <p className="font-display text-xl font-semibold">No found items match yet</p>
          <p className="mt-2 text-ink/60">
            Picked something up around campus? Report it so its owner can find it here.
          </p>
          <Link
            to="/report-found"
            className="mt-5 inline-block rounded-full bg-board px-6 py-3 text-sm font-semibold text-cream"
          >
            + Report found
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
