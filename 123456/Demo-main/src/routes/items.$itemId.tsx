import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useConversations } from "@/hooks/use-conversations";
import {
  CLAIM_STATUS_LABEL,
  fetchClaimsForItem,
  fetchHandoversForClaims,
  fetchItem,
  fetchMyFeedback,
  isItemReporter,
  isCampusStaff,
  saveHandoverEvidence,
  submitClaim,
  submitContactRequest,
  confirmHandover,
  submitFeedback,
} from "@/lib/items";

export const Route = createFileRoute("/items/$itemId")({
  head: () => ({ meta: [{ title: "Item details — CampusFind" }] }),
  component: ItemDetailPage,
});

const fieldClass =
  "w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-ink";
const primaryButton =
  "rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5 disabled:opacity-60";
const secondaryButton =
  "rounded-full border-2 border-ink/15 bg-white px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-60";

function ItemDetailPage() {
  const { itemId } = Route.useParams();
  const { user } = useAuth();
  const conversationsQuery = useConversations(user?.id);
  const queryClient = useQueryClient();
  const [claimText, setClaimText] = useState("");
  const [contactText, setContactText] = useState("");
  const [evidence, setEvidence] = useState("");
  const [rating, setRating] = useState("5");
  const [feedbackText, setFeedbackText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const itemQuery = useQuery({ queryKey: ["item", itemId], queryFn: () => fetchItem(itemId) });
  const item = itemQuery.data;
  const reporterQuery = useQuery({
    queryKey: ["is-item-reporter", itemId, user?.id],
    queryFn: () => isItemReporter(itemId),
    enabled: !!user && !!item,
  });
  const staffQuery = useQuery({
    queryKey: ["is-campus-staff", user?.id],
    queryFn: isCampusStaff,
    enabled: !!user,
  });
  const claimsQuery = useQuery({
    queryKey: ["claims", itemId, user?.id],
    queryFn: () => fetchClaimsForItem(itemId),
    enabled: !!user && !!item,
  });
  const claims = claimsQuery.data ?? [];
  const isReporter = reporterQuery.data === true;
  const isStaff = staffQuery.data === true;
  const ownClaim = claims.find((claim) => claim.claimant_id === user?.id);
  const visibleClaim = ownClaim ?? (isReporter || isStaff ? claims[0] : undefined);
  const conversation = conversationsQuery.data?.find((entry) => entry.claim_id === visibleClaim?.id);
  const handoversQuery = useQuery({
    queryKey: ["handovers", visibleClaim?.id],
    queryFn: () => fetchHandoversForClaims(visibleClaim ? [visibleClaim.id] : []),
    enabled: !!visibleClaim && ["approved", "handover_pending"].includes(visibleClaim.status),
  });
  const handover = handoversQuery.data?.[0];
  const feedbackQuery = useQuery({
    queryKey: ["feedback", visibleClaim?.id, user?.id],
    queryFn: () => fetchMyFeedback(visibleClaim!.id, user!.id),
    enabled: !!visibleClaim && visibleClaim.status === "returned" && !!user,
  });

  async function runAction(action: () => Promise<void>, success: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      setNotice(success);
      await queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["claims", itemId] });
      await queryClient.invalidateQueries({ queryKey: ["my-conversations", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["handovers"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["my-items"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't complete that action.");
    } finally {
      setBusy(false);
    }
  }

  function submitForm(
    event: FormEvent<HTMLFormElement>,
    action: () => Promise<void>,
    success: string,
  ) {
    event.preventDefault();
    void runAction(action, success);
  }

  if (itemQuery.isLoading)
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 text-center text-ink/60">
        Loading item details…
      </div>
    );
  if (itemQuery.isError)
    return (
      <div role="alert" className="mx-auto max-w-4xl px-5 py-16 text-center text-tomato">
        We couldn't load this item. Please try again.
      </div>
    );
  if (!item)
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-semibold">Item not found</h1>
        <Link to="/found" className="mt-5 inline-block text-tomato underline">
          Back to found items
        </Link>
      </div>
    );

  const date = item.occurredAt
    ? new Date(item.occurredAt).toLocaleString()
    : new Date(item.createdAt ?? "").toLocaleString();
  const canClaim =
    item.status === "found" &&
    item.itemStatus === "open" &&
    !isReporter &&
    !!user &&
    reporterQuery.isSuccess;
  const statusLabel =
    item.itemStatus === "returned"
      ? "Returned"
      : item.itemStatus === "claimed"
        ? "Claim in progress"
        : "Open";
  const currentStage = visibleClaim
    ? visibleClaim.status === "pending"
      ? 2
      : visibleClaim.status === "approved"
        ? 3
        : visibleClaim.status === "handover_pending"
          ? 4
          : visibleClaim.status === "returned"
            ? 5
            : 1
    : item.itemStatus === "returned"
      ? 5
      : item.itemStatus === "claimed"
        ? 2
        : 0;
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <Link
        to={item.status === "lost" ? "/lost" : "/found"}
        className="text-sm font-semibold text-tomato underline decoration-2 underline-offset-4"
      >
        ← Back to {item.status} items
      </Link>
      <article className="mt-6 overflow-hidden rounded-3xl border-2 border-ink/10 bg-white">
        {item.photoUrl && (
          <img src={item.photoUrl} alt={item.title} className="max-h-[28rem] w-full object-cover" />
        )}
        <div className="p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="rounded-full bg-mustard/30 px-3 py-1 text-ink">{item.category}</span>
            <span
              className={
                item.status === "lost"
                  ? "rounded-full bg-tomato/12 px-3 py-1 text-tomato"
                  : "rounded-full bg-board/12 px-3 py-1 text-board"
              }
            >
              {item.status === "lost" ? "Lost item" : "Found item"}
            </span>
            <span className="rounded-full bg-ink/10 px-3 py-1 text-ink">{statusLabel}</span>
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight">{item.title}</h1>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-ink/55">Location</dt>
              <dd className="mt-1">{item.location}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-ink/55">Date and time</dt>
              <dd className="mt-1">{date}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-ink/55">Reported by</dt>
              <dd className="mt-1">{item.reporter ?? "Campus member"}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-ink/55">Current status</dt>
              <dd className="mt-1">{statusLabel}</dd>
            </div>
          </dl>
          {item.description && (
            <section className="mt-7">
              <h2 className="font-display text-xl font-semibold">Description</h2>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink/75">
                {item.description}
              </p>
            </section>
          )}
          <section className="mt-8 rounded-2xl bg-cream p-5">
            <h2 className="font-display text-lg font-semibold">Status progression</h2>
            <ol
              className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/65"
              aria-label="Item status progression"
            >
              {["Open", "Claim requested", "Verification", "Approved", "Handover", "Returned"].map(
                (step, index) => (
                  <li
                    key={step}
                    className={index <= currentStage ? "font-semibold text-board" : ""}
                  >
                    {index > 0 && (
                      <span aria-hidden="true" className="mr-2">
                        →
                      </span>
                    )}
                    {step}
                  </li>
                ),
              )}
            </ol>
            {!user && (
              <p className="mt-2 text-xs text-ink/55">
                Private claim progress is visible only to the claimant, item reporter, and
                authorized staff.
              </p>
            )}
          </section>

          {item.itemStatus !== "returned" &&
            (!user || (reporterQuery.isSuccess && !isReporter)) && (
              <div className="mt-7 flex flex-wrap gap-3">
                {canClaim && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button type="button" className={primaryButton}>
                        Claim this item
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-ink/10 bg-cream">
                      <DialogHeader>
                        <DialogTitle className="font-display text-2xl">Claim this item</DialogTitle>
                        <DialogDescription>
                          Only authorized staff and the item reporter can review these private
                          details. CampusFind does not automatically verify ownership.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={(event) =>
                          submitForm(
                            event,
                            async () => {
                              await submitClaim(item.id, claimText);
                              setClaimText("");
                            },
                            "Your claim was submitted for staff verification.",
                          )
                        }
                        className="mt-4 flex flex-col gap-4"
                      >
                        <label htmlFor="claim-details" className="text-sm font-semibold">
                          What private details identify this item?
                        </label>
                        <textarea
                          id="claim-details"
                          required
                          minLength={10}
                          maxLength={2000}
                          rows={5}
                          value={claimText}
                          onChange={(event) => setClaimText(event.target.value)}
                          placeholder="Describe hidden marks, approximate contents, or another detail only the owner would know."
                          className={fieldClass}
                        />
                        <p className="text-xs text-ink/60">
                          Do not include passwords or payment-card details. Your answer is stored
                          privately for verification.
                        </p>
                        <button type="submit" disabled={busy} className={primaryButton}>
                          {busy ? "Submitting…" : "Submit claim"}
                        </button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
                {!user && item.status === "found" && item.itemStatus === "open" && (
                  <Link
                    to="/auth"
                    search={{ mode: "signin", next: `/items/${item.id}` }}
                    className={primaryButton}
                  >
                    Sign in to claim
                  </Link>
                )}
                {user && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button type="button" className={secondaryButton}>
                        Contact about this item
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-ink/10 bg-cream">
                      <DialogHeader>
                        <DialogTitle className="font-display text-2xl">
                          Contact about this item
                        </DialogTitle>
                        <DialogDescription>
                          This sends a private request to the person who reported the item. Replies
                          are not available inside CampusFind yet. Do not include contact details or
                          sensitive IDs.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={(event) =>
                          submitForm(
                            event,
                            async () => {
                              await submitContactRequest(item.id, contactText);
                              setContactText("");
                            },
                            "Your private request was sent to the item reporter.",
                          )
                        }
                        className="mt-4 flex flex-col gap-4"
                      >
                        <label htmlFor="contact-message" className="text-sm font-semibold">
                          Your message
                        </label>
                        <textarea
                          id="contact-message"
                          required
                          minLength={5}
                          maxLength={1000}
                          rows={4}
                          value={contactText}
                          onChange={(event) => setContactText(event.target.value)}
                          className={fieldClass}
                        />
                        <button type="submit" disabled={busy} className={primaryButton}>
                          {busy ? "Sending…" : "Send request"}
                        </button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )}

          {visibleClaim && (
            <section className="mt-8 rounded-2xl border-2 border-ink/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold">
                  Claim status: {CLAIM_STATUS_LABEL[visibleClaim.status]}
                </h2>
                {conversation && (
                  <Link
                    to="/messages/$conversationId"
                    params={{ conversationId: conversation.conversation_id }}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    Open Chat
                  </Link>
                )}
              </div>
              {visibleClaim.review_note && (
                <p className="mt-2 text-sm text-ink/70">Staff note: {visibleClaim.review_note}</p>
              )}
              {(isReporter || isStaff) && (
                <details className="mt-4">
                  <summary className="cursor-pointer font-semibold">
                    Private ownership details for verification
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink/75">
                    {visibleClaim.verification_details}
                  </p>
                </details>
              )}
              {handover && (
                <div className="mt-4 border-t border-ink/10 pt-4">
                  <h3 className="font-semibold">Handover confirmation</h3>
                  <p className="mt-1 text-sm text-ink/65">
                    Started {new Date(handover.started_at).toLocaleString()}. Claimant:{" "}
                    {handover.claimant_confirmed ? "confirmed" : "waiting"}; finder:{" "}
                    {handover.finder_confirmed ? "confirmed" : "waiting"}; staff:{" "}
                    {handover.staff_confirmed ? "confirmed" : "waiting"}.
                  </p>
                  {handover.completed_at && (
                    <p className="mt-2 font-semibold text-board">
                      Returned {new Date(handover.completed_at).toLocaleString()}
                    </p>
                  )}
                  {!handover.completed_at &&
                    (user?.id === visibleClaim.claimant_id || isReporter) && (
                      <div className="mt-4 flex flex-col gap-3">
                        <label htmlFor="handover-evidence" className="text-sm font-semibold">
                          Optional handover note or evidence
                        </label>
                        <textarea
                          id="handover-evidence"
                          rows={2}
                          maxLength={1000}
                          value={evidence}
                          onChange={(event) => setEvidence(event.target.value)}
                          className={fieldClass}
                        />
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                () => saveHandoverEvidence(visibleClaim.id, evidence),
                                "Handover note saved privately.",
                              )
                            }
                            className={secondaryButton}
                          >
                            Save note
                          </button>
                          <button
                            type="button"
                            disabled={
                              busy ||
                              (user.id === visibleClaim.claimant_id
                                ? handover.claimant_confirmed
                                : handover.finder_confirmed)
                            }
                            onClick={() =>
                              void runAction(
                                () => confirmHandover(visibleClaim.id),
                                "Your handover confirmation was recorded.",
                              )
                            }
                            className={primaryButton}
                          >
                            {user.id === visibleClaim.claimant_id
                              ? "Confirm I received the item"
                              : "Confirm I handed over the item"}
                          </button>
                        </div>
                      </div>
                    )}
                  {isStaff && visibleClaim.status === "handover_pending" && (
                    <p className="mt-3 text-sm text-ink/65">
                      Both parties have confirmed. Authorized staff can complete the return in the
                      staff dashboard.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {visibleClaim?.status === "returned" &&
            user &&
            (feedbackQuery.data ? (
              <p className="mt-8 rounded-2xl bg-mustard/30 p-4 text-sm text-ink">
                Thank you. Your private feedback was recorded with a rating of{" "}
                {feedbackQuery.data.rating}/5.
              </p>
            ) : (
              <FeedbackForm
                claimId={visibleClaim.id}
                busy={busy}
                rating={rating}
                setRating={setRating}
                comment={feedbackText}
                setComment={setFeedbackText}
                onSubmit={(event) =>
                  submitForm(
                    event,
                    async () => {
                      await submitFeedback(visibleClaim.id, Number(rating), feedbackText);
                      setFeedbackText("");
                      await feedbackQuery.refetch();
                    },
                    "Thank you. Your private feedback was submitted.",
                  )
                }
              />
            ))}
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-2xl bg-tomato/12 p-4 text-sm font-medium text-tomato"
            >
              {error}
            </p>
          )}
          {claimsQuery.isError && (
            <p
              role="alert"
              className="mt-5 rounded-2xl bg-tomato/12 p-4 text-sm font-medium text-tomato"
            >
              Private claim status is unavailable. Please try again later.
            </p>
          )}
          {reporterQuery.isError && (
            <p
              role="alert"
              className="mt-5 rounded-2xl bg-tomato/12 p-4 text-sm font-medium text-tomato"
            >
              We couldn't verify item ownership permissions. Please try again.
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="mt-5 rounded-2xl bg-mustard/30 p-4 text-sm font-medium text-ink"
            >
              {notice}
            </p>
          )}
        </div>
      </article>
    </div>
  );
}

function FeedbackForm({
  claimId,
  busy,
  rating,
  setRating,
  comment,
  setComment,
  onSubmit,
}: {
  claimId: string;
  busy: boolean;
  rating: string;
  setRating: (value: string) => void;
  comment: string;
  setComment: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-8 rounded-2xl border-2 border-ink/10 p-5">
      <h2 className="font-display text-xl font-semibold">How did it go?</h2>
      <p className="mt-1 text-sm text-ink/60">Feedback is private to you and authorized staff.</p>
      <label htmlFor={`rating-${claimId}`} className="mt-4 block text-sm font-semibold">
        Rating
      </label>
      <select
        id={`rating-${claimId}`}
        value={rating}
        onChange={(event) => setRating(event.target.value)}
        className={fieldClass}
      >
        {[5, 4, 3, 2, 1].map((score) => (
          <option key={score} value={score}>
            {score} / 5
          </option>
        ))}
      </select>
      <label htmlFor={`feedback-${claimId}`} className="mt-4 block text-sm font-semibold">
        Optional comment
      </label>
      <textarea
        id={`feedback-${claimId}`}
        rows={3}
        maxLength={1000}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        className={fieldClass}
      />
      <button type="submit" disabled={busy} className={`${primaryButton} mt-4`}>
        {busy ? "Submitting…" : "Send feedback"}
      </button>
    </form>
  );
}
