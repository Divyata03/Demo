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
      <section className="mx-auto max-w-6xl px-5 pb-6 pt-10 sm:px-8 sm:pt-14 lg:pt-16">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-sm font-semibold text-blue-800">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-emerald-500" />
              Campus community recovery, simplified
            </span>

            <h1 className="mt-6 max-w-[16ch] font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.06em] text-slate-900 sm:text-5xl lg:text-6xl">
              Lost Something on Campus?
            </h1>

            <p className="mt-5 max-w-[52ch] text-lg leading-8 text-slate-600">
              Find it faster. Report it easily. Get it back safely.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/report-lost"
                className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#172554_0%,#2563eb_100%)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(37,99,235,0.22)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(37,99,235,0.25)]"
              >
                Report Lost Item
              </Link>
              <Link
                to="/found"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
              >
                Browse Found Items
              </Link>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["1.2k+", "items tracked"],
                ["92%", "match rate"],
                ["24/7", "campus support"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
                  <div className="font-display text-2xl font-extrabold tracking-[-0.05em] text-slate-900">
                    {value}
                  </div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-4 top-10 h-32 w-32 rounded-full bg-blue-200/50 blur-3xl" />
            <div className="absolute -right-2 bottom-10 h-32 w-32 rounded-full bg-teal-200/60 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
              <div className="overflow-hidden rounded-[1.5rem]">
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"
                  alt="Students collaborating on campus while checking a lost-and-found board"
                  className="h-[470px] w-full object-cover"
                  loading="eager"
                />
              </div>
            </div>

            <div className="absolute -bottom-5 left-5 right-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Today on campus
                  </p>
                  <p className="mt-1 font-display text-xl font-extrabold tracking-[-0.04em] text-slate-900">
                    14 new matches
                  </p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-700">
                  ✓
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8 lg:pt-14">
        <div className="mb-6 flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-slate-900 sm:text-3xl">
            Browse by category
          </h2>
          <span className="text-sm font-medium text-slate-500">Quick access</span>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <li key={cat}>
              <Link
                to="/lost"
                search={{ cat }}
                className="block rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
              >
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                  {CATEGORY_ICON[cat]}
                </span>
                <span className="mt-4 block font-semibold text-slate-800">{cat}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="recent-items" className="mx-auto max-w-6xl px-5 pb-6 pt-12 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-slate-900 sm:text-3xl">
            {query.trim() ? "Matching items on the board" : "Recently on the board"}
          </h2>
          <Link to="/lost" className="text-sm font-semibold text-blue-700">
            See everything →
          </Link>
        </div>
        {isLoading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm">
                <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
                <div className="mt-4 h-4 w-20 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 h-5 w-2/3 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
                <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <p
            role="alert"
            className="mt-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-6 text-center font-medium text-rose-700"
          >
            The board is temporarily unavailable. Please try again.
          </p>
        ) : recent.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
              🔎
            </div>
            <h3 className="mt-4 font-display text-xl font-extrabold text-slate-900">
              {query.trim() ? "No items match your search" : "No items yet"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {query.trim()
                ? `Nothing matches "${query}" right now. Try another word, or report it so others can look out for it.`
                : "The board is empty right now. Be the first to report a lost or found item."}
            </p>
          </div>
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
