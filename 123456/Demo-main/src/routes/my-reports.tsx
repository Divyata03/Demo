import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { useAuth } from "@/hooks/use-auth";
import {
  CLAIM_STATUS_LABEL,
  fetchClaimsForItems,
  fetchContactRequestsForItems,
  fetchMyItems,
  ITEM_STATUS_LABEL,
} from "@/lib/items";

export const Route = createFileRoute("/my-reports")({
  head: () => ({ meta: [{ title: "My Reports — CampusFind" }] }),
  component: MyReportsPage,
});

function MyReportsPage() {
  const { user, loading } = useAuth();
  const itemsQuery = useQuery({
    queryKey: ["my-items", user?.id],
    queryFn: fetchMyItems,
    enabled: !!user,
  });
  const items = itemsQuery.data ?? [];
  const itemIds = items.map((item) => item.id);
  const claimsQuery = useQuery({
    queryKey: ["my-claims", user?.id, itemIds],
    queryFn: () => fetchClaimsForItems(itemIds),
    enabled: !!user && itemsQuery.isSuccess,
  });
  const contactsQuery = useQuery({
    queryKey: ["my-contact-requests", user?.id, itemIds],
    queryFn: () => fetchContactRequestsForItems(itemIds),
    enabled: !!user && itemsQuery.isSuccess,
  });
  const claims = claimsQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];

  if (loading)
    return <div className="px-5 py-24 text-center text-ink/60">Loading your reports…</div>;
  if (!user) return <SignInPrompt next="/my-reports" action="view your reports" />;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full bg-mustard/30 px-4 py-1.5 text-sm font-medium text-ink">
        Your campus activity
      </span>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        My Reports
      </h1>
      <p className="mt-3 max-w-[52ch] text-lg text-ink/70">
        Your reports and private requests related to them.
      </p>

      {itemsQuery.isLoading ? (
        <p className="mt-8 text-center text-ink/60">Loading your reports…</p>
      ) : itemsQuery.isError ? (
        <p
          role="alert"
          className="mt-8 rounded-3xl bg-tomato/12 p-6 text-center font-medium text-tomato"
        >
          We couldn't load your reports. Please try again.
        </p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-3xl border-2 border-dashed border-ink/15 bg-white/60 p-10 text-center">
          <p className="font-display text-xl font-semibold">No reports yet</p>
          <p className="mt-2 text-ink/60">Your lost and found reports will appear here.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              to="/report-lost"
              className="rounded-full bg-tomato px-5 py-3 text-sm font-semibold text-cream"
            >
              Report lost
            </Link>
            <Link
              to="/report-found"
              className="rounded-full bg-board px-5 py-3 text-sm font-semibold text-cream"
            >
              Report found
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {items.map((item) => {
            const itemClaims = claims.filter((claim) => claim.item_id === item.id);
            const itemContacts = contacts.filter((request) => request.item_id === item.id);
            const latestClaim = itemClaims[0];
            return (
              <article
                key={item.id}
                className="rounded-3xl border-2 border-ink/10 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-mustard/30 px-3 py-1 text-xs font-semibold">
                        {item.category}
                      </span>
                      <span
                        className={
                          item.status === "lost"
                            ? "rounded-full bg-tomato/12 px-3 py-1 text-xs font-semibold text-tomato"
                            : "rounded-full bg-board/12 px-3 py-1 text-xs font-semibold text-board"
                        }
                      >
                        {item.status === "lost" ? "Lost" : "Found"}
                      </span>
                      <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold">
                        {item.itemStatus ? ITEM_STATUS_LABEL[item.itemStatus] : "Open"}
                      </span>
                    </div>
                    <h2 className="mt-3 font-display text-2xl font-semibold">{item.title}</h2>
                    <p className="mt-2 text-sm text-ink/65">
                      {item.location} · {new Date(item.createdAt ?? "").toLocaleDateString()}
                    </p>
                    {latestClaim && (
                      <p className="mt-3 text-sm font-semibold text-board">
                        Claim: {CLAIM_STATUS_LABEL[latestClaim.status]}
                      </p>
                    )}
                  </div>
                  <Link
                    to="/items/$itemId"
                    params={{ itemId: item.id }}
                    className="rounded-full border-2 border-ink/15 px-5 py-2.5 text-sm font-semibold"
                  >
                    View details
                  </Link>
                </div>
                {itemClaims.length > 0 && (
                  <details className="mt-4 border-t border-ink/10 pt-4">
                    <summary className="cursor-pointer text-sm font-semibold">
                      {itemClaims.length} claim request{itemClaims.length === 1 ? "" : "s"}
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      {itemClaims.map((claim) => (
                        <div key={claim.id} className="rounded-2xl bg-cream p-4">
                          <p className="text-sm font-semibold">
                            {CLAIM_STATUS_LABEL[claim.status]} ·{" "}
                            {new Date(claim.created_at).toLocaleString()}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-ink/70">
                            Private ownership details: {claim.verification_details}
                          </p>
                          {claim.review_note && (
                            <p className="mt-2 text-sm text-ink/60">
                              Staff note: {claim.review_note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {itemContacts.length > 0 && (
                  <details className="mt-4 border-t border-ink/10 pt-4">
                    <summary className="cursor-pointer text-sm font-semibold">
                      {itemContacts.length} private contact request
                      {itemContacts.length === 1 ? "" : "s"}
                    </summary>
                    <div className="mt-3 flex flex-col gap-2">
                      {itemContacts.map((request) => (
                        <p
                          key={request.id}
                          className="rounded-2xl bg-cream p-4 text-sm text-ink/70"
                        >
                          {request.message}{" "}
                          <span className="mt-2 block text-xs text-ink/50">
                            {new Date(request.created_at).toLocaleString()} · Reply inside
                            CampusFind is not available yet.
                          </span>
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
      {(claimsQuery.isError || contactsQuery.isError) && (
        <p role="alert" className="mt-5 rounded-2xl bg-tomato/12 p-4 text-sm text-tomato">
          Some claim or contact information could not be loaded.
        </p>
      )}
      {claimsQuery.isSuccess && claims.length === 0 && items.length > 0 && (
        <p className="mt-6 text-sm text-ink/60">No claim requests yet.</p>
      )}
    </div>
  );
}
