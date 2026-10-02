import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyItems, fetchProfile, ROLE_LABEL, saveProfileName } from "@/lib/items";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My Profile — CampusFind" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useAuth();
  const [fullName, setFullName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });
  const reportsQuery = useQuery({
    queryKey: ["my-items", user?.id],
    queryFn: fetchMyItems,
    enabled: !!user,
  });
  const profile = profileQuery.data;
  const reports = reportsQuery.data ?? [];
  const returnedCount = reports.filter((item) => item.itemStatus === "returned").length;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveProfileName(fullName ?? profile?.full_name ?? "");
      await profileQuery.refetch();
      setFullName(null);
      setNotice("Your name has been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't update your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <div className="px-5 py-24 text-center text-ink/60">Loading your profile…</div>;
  if (!user) return <SignInPrompt next="/profile" action="view your profile" />;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full bg-mustard/30 px-4 py-1.5 text-sm font-medium text-ink">
        Your account
      </span>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        My Profile
      </h1>
      {profileQuery.isLoading ? (
        <p className="mt-8 text-center text-ink/60">Loading profile…</p>
      ) : profileQuery.isError ? (
        <p
          role="alert"
          className="mt-8 rounded-3xl bg-tomato/12 p-6 text-center font-medium text-tomato"
        >
          We couldn't load your profile.
        </p>
      ) : !profile ? (
        <p className="mt-8 rounded-3xl bg-mustard/30 p-6">
          Your profile record is not available yet. Please contact campus support.
        </p>
      ) : (
        <>
          <div className="mt-8 rounded-3xl border-2 border-ink/10 bg-white p-6 sm:p-8">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-ink/55">College email</dt>
                <dd className="mt-1 break-all">{profile.college_email}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink/55">Campus role</dt>
                <dd className="mt-1">{ROLE_LABEL[profile.campus_role]}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink/55">Reports</dt>
                <dd className="mt-1">{reportsQuery.isLoading ? "Loading…" : reports.length}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink/55">Returned items</dt>
                <dd className="mt-1">{reportsQuery.isLoading ? "Loading…" : returnedCount}</dd>
              </div>
            </dl>
            <form onSubmit={onSubmit} className="mt-8 border-t border-ink/10 pt-6">
              <label htmlFor="profile-name" className="mb-2 block text-sm font-semibold">
                Name
              </label>
              <input
                id="profile-name"
                required
                minLength={2}
                maxLength={80}
                value={fullName ?? profile.full_name}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3.5 text-base outline-none focus:border-ink"
              />
              <p className="mt-2 text-xs text-ink/55">
                Your name is the only profile field you can edit here. Campus role and permissions
                are controlled separately.
              </p>
              {error && (
                <p role="alert" className="mt-4 rounded-2xl bg-tomato/12 p-3 text-sm text-tomato">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="mt-4 rounded-2xl bg-mustard/30 p-3 text-sm text-ink">
                  {notice}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="mt-5 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save name"}
              </button>
            </form>
          </div>
          {reportsQuery.isError && (
            <p role="alert" className="mt-4 text-sm text-tomato">
              Report totals are temporarily unavailable.
            </p>
          )}
        </>
      )}
    </div>
  );
}
