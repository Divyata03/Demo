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
  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
      className="block overflow-hidden rounded-3xl border-2 border-ink/10 bg-white transition-transform hover:-translate-y-1 focus-visible:outline-3 focus-visible:outline-board"
    >
      <article>
        {item.photoUrl && (
          <img
            src={item.photoUrl}
            alt={item.title}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover"
          />
        )}
        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <span
              className={
                "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide " +
                CATEGORY_CHIP[item.category]
              }
            >
              {item.category}
            </span>
            <span className="text-xs font-medium text-ink/50">{item.time}</span>
          </div>
          <div className="mt-4 flex items-start gap-3">
            {!item.photoUrl && (
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cream text-xl"
              >
                {CATEGORY_ICON[item.category]}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-display text-xl font-semibold leading-snug">{item.title}</h3>
              <p className="mt-2 text-sm text-ink/60">
                {item.location} ·{" "}
                <span
                  className={
                    item.status === "lost"
                      ? "font-semibold text-tomato"
                      : "font-semibold text-board"
                  }
                >
                  {item.status === "lost" ? "Lost" : "Found"}
                </span>
                {item.itemStatus && item.itemStatus !== "open" && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-semibold text-ink">
                      {ITEM_STATUS_LABEL[item.itemStatus]}
                    </span>
                  </>
                )}
              </p>
              {item.description && (
                <p className="mt-2 line-clamp-3 text-sm text-ink/70">{item.description}</p>
              )}
              {item.reporter && (
                <p className="mt-3 text-xs font-medium text-ink/50">Posted by {item.reporter}</p>
              )}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
