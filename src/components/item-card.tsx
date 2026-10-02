import { CATEGORY_ICON, type Category, type Item } from "@/data/items";
import { ITEM_STATUS_LABEL } from "@/lib/items";
import { Link } from "@tanstack/react-router";

const CATEGORY_CHIP: Record<Category, string> = {
  Keys: "bg-tomato/12 text-tomato",
  Bottles: "bg-board/12 text-board",
  Phones: "bg-mustard/40 text-ink",
  Bags: "bg-board/12 text-board",
  Cards: "bg-mustard/40 text-ink",
  Books: "bg-tomato/12 text-tomato",
  Clothing: "bg-board/12 text-board",
  Other: "bg-ink/10 text-ink",
};

export function ItemCard({ item }: { item: Item }) {
  const isLost = item.status === "lost";

  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
      className="group block overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.1)] focus-visible:outline-3 focus-visible:outline-blue-500"
    >
      <article>
        {item.photoUrl ? (
          <div className="relative overflow-hidden">
            <img
              src={item.photoUrl}
              alt={item.title}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />
            <span
              className={
                "absolute left-4 top-4 rounded-full border border-white/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] " +
                (isLost ? "bg-rose-500/90 text-white" : "bg-teal-500/90 text-white")
              }
            >
              {isLost ? "Lost" : "Found"}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#e2e8f0,#f8fafc)] text-2xl">
              {CATEGORY_ICON[item.category]}
            </span>
            <span
              className={
                "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] " +
                (isLost ? "bg-rose-100 text-rose-700" : "bg-teal-100 text-teal-700")
              }
            >
              {isLost ? "Lost" : "Found"}
            </span>
          </div>
        )}

        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <span
              className={
                "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] " +
                CATEGORY_CHIP[item.category]
              }
            >
              {item.category}
            </span>
            <span className="text-xs font-medium text-slate-500">{item.time}</span>
          </div>

          <div className="mt-4 min-w-0">
            <h3 className="font-display text-xl font-extrabold leading-tight tracking-[-0.03em] text-slate-900">
              {item.title}
            </h3>

            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>{item.location}</span>
              <span className="text-slate-300">•</span>
              <span className={isLost ? "font-semibold text-rose-600" : "font-semibold text-teal-700"}>
                {isLost ? "Lost" : "Found"}
              </span>
            </p>

            {item.description && (
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>
            )}

            {item.itemStatus && item.itemStatus !== "open" && (
              <div className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                {ITEM_STATUS_LABEL[item.itemStatus]}
              </div>
            )}

            {item.reporter && (
              <p className="mt-4 text-xs font-medium text-slate-500">Posted by {item.reporter}</p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
