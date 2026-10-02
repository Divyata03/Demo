import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { useAuth } from "@/hooks/use-auth";
import {
  CLAIM_STATUS_LABEL,
  completeHandover,
  fetchClaimsForItems,
  fetchClaimantProfiles,
  fetchHandoversForClaims,
  fetchItems,
  isCampusStaff,
  moderateItem,
  reviewClaim,
} from "@/lib/items";

export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [{ title: "Staff Dashboard — CampusFind" }] }),
  component: StaffDashboard,
});

function StaffDashboard() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const staffQuery = useQuery({
    queryKey: ["is-campus-staff", user?.id],
    queryFn: isCampusStaff,
    enabled: !!user,
  });
  const boardQuery = useQuery({
    queryKey: ["staff-dashboard"],
    enabled: staffQuery.data === true,
    queryFn: async () => {
      const items = await fetchItems({ includeHidden: true, limit: 200 });
      const claims = await fetchClaimsForItems(items.map((item) => item.id));
      const handovers = await fetchHandoversForClaims(claims.map((claim) => claim.id));
      const profiles = await fetchClaimantProfiles(claims.map((claim) => claim.claimant_id));
      return { items, claims, handovers, profiles };
    },
  });
  const dashboard = boardQuery.data;

  async function act(id: string, action: () => Promise<void>) {
    setError(null);
    setBusyId(id);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["staff-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["my-items"] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["item"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The staff action could not be completed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading)
    return <div className="px-5 py-24 text-center text-ink/60">Checking staff access…</div>;
  if (!user) return <SignInPrompt next="/staff" action="open the staff dashboard" />;
  if (staffQuery.isLoading)
    return <div className="px-5 py-24 text-center text-ink/60">Checking staff access…</div>;
  if (staffQuery.isError)
    return (
      <div role="alert" className="mx-auto max-w-4xl px-5 py-16 text-center text-tomato">
        Staff access could not be checked. Apply the CampusFind workflow migration and try again.
      </div>
    );
  if (!staffQuery.data)
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <div className="rounded-3xl border-2 border-ink/10 bg-white p-8 text-center">
          <h1 className="font-display text-3xl font-semibold">Staff access required</h1>
          <p className="mt-3 text-ink/70">
            This dashboard is available only to accounts added to the trusted campus staff roster.
            Selecting a staff role on your profile does not grant access.
          </p>
        </div>
      </div>
    );

  const items = dashboard?.items ?? [];
  const claims = dashboard?.claims ?? [];
  const handovers = dashboard?.handovers ?? [];
  const titleFor = (itemId: string) =>
    items.find((item) => item.id === itemId)?.title ?? "Campus item";
  const pendingClaims = claims.filter((claim) => claim.status === "pending");
  const pendingHandovers = claims.filter((claim) => claim.status === "handover_pending");
  const returnedClaims = claims.filter((claim) => claim.status === "returned");

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full bg-mustard/30 px-4 py-1.5 text-sm font-medium text-ink">
        Authorized staff
      </span>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Staff Dashboard
      </h1>
      <p className="mt-3 max-w-[60ch] text-ink/70">
        Review claims, coordinate confirmed handovers, and hide inappropriate reports. Decisions are
        recorded through staff-authorized database functions.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-2xl bg-tomato/12 p-4 text-sm font-medium text-tomato"
        >
          {error}
        </p>
      )}
      {boardQuery.isLoading ? (
        <p className="mt-8 text-center text-ink/60">Loading staff queue…</p>
      ) : boardQuery.isError ? (
        <p role="alert" className="mt-8 rounded-3xl bg-tomato/12 p-6 text-center text-tomato">
          We couldn't load the staff queue. Check the workflow migration and your staff permissions.
        </p>
      ) : (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Reports", items.length],
              ["Pending claims", pendingClaims.length],
              ["Handover cases", pendingHandovers.length],
              ["Returned", returnedClaims.length],
            ].map(([label, count]) => (
              <div key={String(label)} className="rounded-2xl border-2 border-ink/10 bg-white p-4">
                <p className="text-sm text-ink/60">{label}</p>
                <p className="mt-1 font-display text-2xl font-semibold">{count}</p>
              </div>
            ))}
          </div>
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">Pending verification</h2>
            {pendingClaims.length === 0 ? (
              <p className="mt-4 rounded-2xl border-2 border-dashed border-ink/15 bg-white/60 p-6 text-ink/60">
                No pending claims.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {pendingClaims.map((claim) => (
                  <article
                    key={claim.id}
                    className="rounded-3xl border-2 border-ink/10 bg-white p-5"
                  >
                    <h3 className="font-display text-xl font-semibold">
                      {titleFor(claim.item_id)}
                    </h3>
                    <p className="mt-1 text-xs text-ink/55">
                      Submitted {new Date(claim.created_at).toLocaleString()}
                    </p>
                    <ClaimantIdentity
                      profile={dashboard?.profiles.find(
                        (profile) => profile.id === claim.claimant_id,
                      )}
                    />
                    <div className="mt-4 rounded-2xl bg-cream p-4">
                      <p className="text-xs font-semibold uppercase text-ink/55">
                        Private ownership details
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">
                        {claim.verification_details}
                      </p>
                    </div>
                    <label
                      htmlFor={`review-${claim.id}`}
                      className="mt-4 block text-sm font-semibold"
                    >
                      Optional private review note
                    </label>
                    <textarea
                      id={`review-${claim.id}`}
                      rows={2}
                      maxLength={1000}
                      value={notes[claim.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [claim.id]: event.target.value }))
                      }
                      className="mt-2 w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() =>
                          void act(claim.id, () =>
                            reviewClaim(claim.id, true, notes[claim.id] ?? ""),
                          )
                        }
                        className="rounded-full bg-board px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
                      >
                        {busyId === claim.id ? "Saving…" : "Approve claim"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() =>
                          void act(claim.id, () =>
                            reviewClaim(claim.id, false, notes[claim.id] ?? ""),
                          )
                        }
                        className="rounded-full bg-tomato px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
                      >
                        Reject claim
                      </button>
                      <Link
                        to="/items/$itemId"
                        params={{ itemId: claim.item_id }}
                        className="rounded-full border-2 border-ink/15 px-5 py-2.5 text-sm font-semibold"
                      >
                        View item
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">Handover cases</h2>
            {pendingHandovers.length === 0 ? (
              <p className="mt-4 rounded-2xl border-2 border-dashed border-ink/15 bg-white/60 p-6 text-ink/60">
                No handovers are awaiting completion.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {pendingHandovers.map((claim) => {
                  const handover = handovers.find((row) => row.claim_id === claim.id);
                  return (
                    <article
                      key={claim.id}
                      className="rounded-3xl border-2 border-ink/10 bg-white p-5"
                    >
                      <h3 className="font-display text-xl font-semibold">
                        {titleFor(claim.item_id)}
                      </h3>
                      <p className="mt-2 text-sm text-ink/65">
                        Claimant: {handover?.claimant_confirmed ? "confirmed" : "waiting"}; finder:{" "}
                        {handover?.finder_confirmed ? "confirmed" : "waiting"}. Staff confirmation
                        is required before marking returned.
                      </p>
                      {handover?.evidence && (
                        <p className="mt-3 rounded-2xl bg-cream p-4 text-sm">
                          Private note: {handover.evidence}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={
                          !handover?.claimant_confirmed ||
                          !handover.finder_confirmed ||
                          busyId === claim.id
                        }
                        onClick={() => void act(claim.id, () => completeHandover(claim.id))}
                        className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
                      >
                        {busyId === claim.id ? "Completing…" : "Confirm handover and mark returned"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">Reported items</h2>
            {items.length === 0 ? (
              <p className="mt-4 text-ink/60">No reports are on the board.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-ink/10 bg-white p-4"
                  >
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="mt-1 text-sm text-ink/60">
                        {item.status} · {item.location} ·{" "}
                        {item.isHidden ? "Hidden from public board" : "Visible on public board"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void act(item.id, () => moderateItem(item.id, !item.isHidden))}
                      className="rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    >
                      {item.isHidden ? "Restore report" : "Hide report"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">Returned items</h2>
            {returnedClaims.length === 0 ? (
              <p className="mt-4 text-ink/60">No completed returns yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {returnedClaims.map((claim) => (
                  <li key={claim.id} className="rounded-2xl border-2 border-ink/10 bg-white p-4">
                    <span className="font-semibold">{titleFor(claim.item_id)}</span>
                    <span className="ml-2 text-sm text-ink/60">
                      {CLAIM_STATUS_LABEL[claim.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

type ClaimantProfile = Awaited<ReturnType<typeof fetchClaimantProfiles>>[number];

function ClaimantIdentity({ profile }: { profile: ClaimantProfile | undefined }) {
  if (!profile)
    return (
      <p className="mt-4 rounded-2xl bg-cream p-4 text-sm text-ink/65">
        The claimant has not completed a profile.
      </p>
    );

  const details =
    profile.user_type === "student"
      ? [
          ["Roll number", profile.student_roll_number],
          ["Department", profile.department],
          ["Semester", profile.semester?.toString()],
          ["Academic year", profile.academic_year],
        ]
      : profile.user_type === "teacher"
        ? [
            ["Staff ID", profile.employee_staff_id],
            ["Department", profile.department],
            ["Subjects", profile.subjects?.join(", ")],
            ["Staff room", profile.staff_room_location],
          ]
        : profile.user_type === "cleaner"
          ? [
              ["Staff ID", profile.employee_staff_id],
              ["Cleaning area", profile.cleaning_area],
              ["Equipment room", profile.equipment_room_location],
              ["Break room", profile.break_room_location],
            ]
          : [
              ["Staff ID", profile.employee_staff_id],
              ["Department", profile.department],
              ["Job role", profile.job_role],
              ["Work location", profile.work_location],
            ];

  return (
    <section className="mt-4 rounded-2xl border border-ink/10 bg-cream p-4">
      <h4 className="text-sm font-semibold">Private claimant profile</h4>
      <p className="mt-1 text-sm">
        {profile.full_name} · {profile.user_type?.replace("_", " ") ?? "Profile incomplete"}
      </p>
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-ink/55">Email</dt>
          <dd className="break-all">{profile.college_email}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink/55">Mobile/WhatsApp</dt>
          <dd>{profile.phone_number ?? "Not provided"}</dd>
        </div>
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-ink/55">{label}</dt>
            <dd>{value ?? "Not provided"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
