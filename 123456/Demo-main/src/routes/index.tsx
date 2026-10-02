import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ItemCard } from "@/components/item-card";
import { CATEGORIES, CATEGORY_ICON } from "@/data/items";
import { fetchItems } from "@/lib/items";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "CampusFind — Lost & Found on campus",
      },
      {
        name: "description",
        content:
          "Report lost items, share what you've found, and reunite belongings with their owners. A simple notice board for students and staff.",
      },
      { property: "og:title", content: "CampusFind — Lost & Found on campus" },
      {
        property: "og:description",
        content:
          "Report lost items, share what you've found, and reunite belongings with their owners. A simple notice board for students and staff.",
      },
      {
        name: "twitter:title",
        content: "CampusFind — Lost & Found on campus",
      },
      {
        name: "twitter:description",
        content:
          "Report lost items, share what you've found, and reunite belongings with their owners.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const {
    data: recent = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["items", "recent", debounced],
    queryFn: () => fetchItems({ search: debounced, limit: 6 }),
  });

  return (
    <div>
      {/* Hero: single clear path */}
      <section className="mx-auto max-w-6xl px-5 pt-12 sm:px-8 sm:pt-16">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-mustard/30 px-4 py-1.5 text-sm font-medium text-ink">
            <span aria-hidden="true" className="size-2 rounded-full bg-tomato" />
            The campus notice board, online
          </span>
          <h1 className="mt-6 max-w-[18ch] font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Lost something, or found it on the walk to class?
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-pretty text-ink/70">
            Search the board below, or report it in a couple of easy steps. Sign in with your
            college email — just a friendly way of getting things back to their owner.
          </p>
        </div>

        {/* Big search */}
        <form
          className="mt-8 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setDebounced(query.trim());
            document.getElementById("recent-items")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <label htmlFor="q" className="sr-only">
            Search items
          </label>
          <div className="flex flex-1 items-center gap-3 rounded-3xl border-2 border-ink bg-white px-5 py-4">
            <span aria-hidden="true" className="text-2xl leading-none text-ink/40">
              🔍
            </span>
            <input
              id="q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try “water bottle”, “ID card”, “keys”…"
              className="w-full bg-transparent text-lg outline-none placeholder:text-ink/40"
            />
          </div>
          <button
            type="submit"
            className="rounded-3xl bg-board px-8 py-4 text-lg font-semibold text-cream transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Search the board
          </button>
        </form>

        {/* Two prominent report buttons */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/report-lost"
            className="group flex items-center justify-between gap-4 rounded-3xl bg-tomato p-6 text-cream ring-1 ring-tomato transition-transform hover:-translate-y-1"
          >
            <span>
              <span className="block font-display text-2xl font-semibold leading-tight">
                Report a lost item
              </span>
              <span className="mt-1 block text-sm text-cream/80">
                Tell us what went missing and where.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cream/15 font-display text-2xl transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
          <Link
            to="/report-found"
            className="group flex items-center justify-between gap-4 rounded-3xl bg-mustard p-6 text-ink transition-transform hover:-translate-y-1"
          >
            <span>
              <span className="block font-display text-2xl font-semibold leading-tight">
                Report a found item
              </span>
              <span className="mt-1 block text-sm text-ink/70">
                Hand it in and we'll look for the owner.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink/10 font-display text-2xl transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
        <h2 className="max-w-[40ch] font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Browse by what you're looking for
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <li key={cat}>
              <Link
                to="/lost"
                search={{ cat }}
                className="block rounded-3xl border-2 border-ink/10 bg-white p-5 transition-transform hover:-translate-y-1"
              >
                <span aria-hidden="true" className="text-3xl">
                  {CATEGORY_ICON[cat]}
                </span>
                <span className="mt-3 block font-medium">{cat}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Recent items */}
      <section id="recent-items" className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="max-w-[40ch] font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {query.trim() ? "Matching items on the board" : "Recently on the board"}
          </h2>
          <Link
            to="/lost"
            className="text-sm font-semibold text-tomato underline decoration-2 underline-offset-4"
          >
            See everything →
          </Link>
        </div>
        {isLoading ? (
          <p className="mt-6 text-center text-ink/60">Loading the board…</p>
        ) : isError ? (
          <p
            role="alert"
            className="mt-6 rounded-3xl bg-tomato/12 p-6 text-center font-medium text-tomato"
          >
            The board is temporarily unavailable. Please try again.
          </p>
        ) : recent.length === 0 ? (
          <p className="mt-6 rounded-3xl border-2 border-dashed border-ink/15 bg-white/60 p-8 text-center text-ink/60">
            {query.trim()
              ? `Nothing matches "${query}" right now. Try another word, or report it so others can look out for it.`
              : "The board is empty for now. Be the first to report a lost or found item."}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
