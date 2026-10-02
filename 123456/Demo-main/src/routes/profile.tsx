import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Camera, Check, MessageCircle, Package, Pencil, X } from "lucide-react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { useAuth } from "@/hooks/use-auth";
import { useConversations } from "@/hooks/use-conversations";
import {
  CLAIM_STATUS_LABEL,
  createProfileAvatarUrl,
  fetchMyClaimSummaries,
  fetchMyItems,
  fetchProfile,
  ITEM_STATUS_LABEL,
  removeProfileAvatar,
  ROLE_LABEL,
  saveMyProfile,
  uploadProfileAvatar,
} from "@/lib/items";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My Profile — CampusFind" }] }),
  component: ProfilePage,
});

type ProfileDraft = {
  full_name: string;
  department: string;
  phone: string;
  semester: string;
  academic_year: string;
  staff_id: string;
  roll_number: string;
  subjects: string;
  staff_room: string;
  cleaning_area: string;
  equipment_room: string;
  rest_room: string;
  job_role: string;
  work_location: string;
};

type ProfileRecord = NonNullable<Awaited<ReturnType<typeof fetchProfile>>>;

function toDraft(profile: ProfileRecord): ProfileDraft {
  return {
    full_name: profile.full_name,
    department: profile.department ?? "",
    phone: profile.phone ?? "",
    semester: profile.semester ?? "",
    academic_year: profile.academic_year ?? "",
    staff_id: profile.staff_id ?? "",
    roll_number: profile.roll_number ?? "",
    subjects: profile.subjects.join(", "),
    staff_room: profile.staff_room ?? "",
    cleaning_area: profile.cleaning_area ?? "",
    equipment_room: profile.equipment_room ?? "",
    rest_room: profile.rest_room ?? "",
    job_role: profile.job_role ?? "",
    work_location: profile.work_location ?? "",
  };
}

function ProfileField({
  id,
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-semibold text-ink/75">
      {label}
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-border bg-card px-3.5 py-3 text-base font-normal text-foreground placeholder:text-muted-foreground"
      />
    </label>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value || "Not added"}</dd>
    </div>
  );
}

function ProfilePage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });
  const itemsQuery = useQuery({
    queryKey: ["my-items", user?.id],
    queryFn: fetchMyItems,
    enabled: !!user,
  });
  const claimsQuery = useQuery({
    queryKey: ["my-claim-summaries", user?.id],
    queryFn: fetchMyClaimSummaries,
    enabled: !!user,
  });
  const conversationsQuery = useConversations(user?.id);
  const profile = profileQuery.data;
  const items = itemsQuery.data ?? [];
  const claims = claimsQuery.data ?? [];
  const conversations = conversationsQuery.data ?? [];

  useEffect(() => {
    if (profile) setDraft(toDraft(profile));
  }, [profile]);

  useEffect(() => {
    let active = true;
    if (!profile?.avatar_path) {
      setAvatarUrl(null);
      return;
    }
    void createProfileAvatarUrl(profile.avatar_path)
      .then((url) => {
        if (active) setAvatarUrl(url);
      })
      .catch(() => {
        if (active) setAvatarUrl(null);
      });
    return () => {
      active = false;
    };
  }, [profile?.avatar_path]);

  useEffect(() => {
    if (!avatarFile) {
      setLocalAvatarUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setLocalAvatarUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile || !draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    let uploadedPath: string | null = null;
    try {
      if (avatarFile) uploadedPath = await uploadProfileAvatar(user.id, avatarFile);
      await saveMyProfile({
        full_name: draft.full_name,
        department: draft.department || null,
        phone: draft.phone || null,
        semester: draft.semester || null,
        academic_year: draft.academic_year || null,
        staff_id: draft.staff_id || null,
        roll_number: draft.roll_number || null,
        subjects: draft.subjects.split(",").map((subject) => subject.trim()).filter(Boolean),
        staff_room: draft.staff_room || null,
        cleaning_area: draft.cleaning_area || null,
        equipment_room: draft.equipment_room || null,
        rest_room: draft.rest_room || null,
        job_role: draft.job_role || null,
        work_location: draft.work_location || null,
        avatar_path: uploadedPath ?? profile.avatar_path,
      });
      if (uploadedPath && profile.avatar_path) void removeProfileAvatar(profile.avatar_path);
      setAvatarFile(null);
      await profileQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["my-conversations"] });
      setEditing(false);
      setNotice("Your profile has been updated.");
    } catch (caught) {
      if (uploadedPath) void removeProfileAvatar(uploadedPath);
      setError(caught instanceof Error ? caught.message : "We couldn't update your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <div className="px-5 py-24 text-center text-muted-foreground">Loading your profile…</div>;
  if (!user) return <SignInPrompt next="/profile" action="view your profile" />;

  if (profileQuery.isLoading)
    return <div className="px-5 py-24 text-center text-muted-foreground">Loading profile…</div>;
  if (profileQuery.isError)
    return (
      <div role="alert" className="mx-auto max-w-3xl px-5 py-20 text-center text-destructive">
        We couldn't load your profile. Please try again.
      </div>
    );
  if (!profile || !draft)
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        Your campus profile is not available yet. Please contact campus support.
      </div>
    );

  const isStudent = profile.campus_role === "student";
  const isTeacher = profile.campus_role === "teacher";
  const isCleaner = profile.campus_role === "cleaning_staff";
  const isOtherStaff = profile.campus_role === "security" || profile.campus_role === "other_staff";
  const details: { label: string; value: string | null }[] = isStudent
    ? [
        { label: "Roll Number", value: profile.roll_number },
        { label: "Department", value: profile.department },
        { label: "Semester", value: profile.semester },
        { label: "Academic year", value: profile.academic_year },
      ]
    : isTeacher
      ? [
          { label: "Staff ID", value: profile.staff_id },
          { label: "Department", value: profile.department },
          { label: "Subjects", value: profile.subjects.join(", ") },
          { label: "Staff room", value: profile.staff_room },
        ]
      : isCleaner
        ? [
            { label: "Staff ID", value: profile.staff_id },
            { label: "Cleaning area", value: profile.cleaning_area },
            { label: "Equipment room", value: profile.equipment_room },
            { label: "Rest / break room", value: profile.rest_room },
          ]
        : [
            { label: "Staff ID", value: profile.staff_id },
            { label: "Department", value: profile.department },
            { label: "Job role", value: profile.job_role },
            { label: "Work location", value: profile.work_location },
          ];
  const lostItems = items.filter((item) => item.status === "lost");
  const foundItems = items.filter((item) => item.status === "found");
  const activeClaims = claims.filter((claim) =>
    ["pending", "approved", "handover_pending"].includes(claim.claim_status),
  );
  const returnedItems = items.filter((item) => item.itemStatus === "returned");
  const activeConversations = conversations.filter((conversation) => conversation.conversation_status === "open");
  const update = (key: keyof ProfileDraft, value: string) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const displayedAvatar = localAvatarUrl ?? avatarUrl;
  const initials = profile.full_name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-7">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-board text-xl font-bold text-cream">
            {displayedAvatar ? (
              <img src={displayedAvatar} alt={`${profile.full_name} profile`} className="size-full object-cover" />
            ) : initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted-foreground">My CampusFind</p>
            <h1 className="mt-1 truncate font-display text-3xl font-semibold">{profile.full_name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {ROLE_LABEL[profile.campus_role]}
              </span>
              {profile.department && <span className="text-sm text-muted-foreground">{profile.department}</span>}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setNotice(null);
            setEditing((current) => !current);
          }}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          {editing ? <X size={16} /> : <Pencil size={16} />}
          {editing ? "Close editor" : "Edit profile"}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Summary label="Lost reports" value={lostItems.length} icon={<Package size={17} />} />
        <Summary label="Found reports" value={foundItems.length} icon={<Package size={17} />} />
        <Summary label="Active claims" value={activeClaims.length} icon={<Check size={17} />} />
        <Summary label="Returned items" value={returnedItems.length} icon={<Check size={17} />} />
        <Summary label="Active chats" value={activeConversations.length} icon={<MessageCircle size={17} />} />
      </div>

      {notice && <p role="status" className="mt-5 rounded-xl bg-success/10 p-3 text-sm text-success">{notice}</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <section className="mt-7 border-t border-border pt-6" aria-labelledby="profile-details-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="profile-details-title" className="font-display text-xl font-semibold">Profile details</h2>
          <span className="text-xs text-muted-foreground">Visible only to you</span>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {details.map((detail) => <ProfileDetail key={detail.label} {...detail} />)}
          <ProfileDetail label="Contact phone" value={profile.phone} />
        </dl>
      </section>

      {editing && (
        <section className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="edit-profile-title">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 id="edit-profile-title" className="font-display text-2xl font-semibold">Edit profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your role is managed by the campus account and cannot be changed here.</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid size-16 place-items-center overflow-hidden rounded-xl bg-muted font-semibold">
                {displayedAvatar ? <img src={displayedAvatar} alt="Profile preview" className="size-full object-cover" /> : initials}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                <Camera size={16} aria-hidden="true" />
                Choose profile photo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <span className="text-xs text-muted-foreground">Image, up to 5 MB. Visible only to you.</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileField id="profile-full-name" label="Full name" value={draft.full_name} required onChange={(value) => update("full_name", value)} />
              <ProfileField id="profile-phone" label="Phone (private)" value={draft.phone} type="tel" onChange={(value) => update("phone", value)} />
              {(isStudent || isTeacher || isOtherStaff) && (
                <ProfileField id="profile-department" label="Department" value={draft.department} required onChange={(value) => update("department", value)} />
              )}
              {isStudent && (
                <>
                  <ProfileField id="profile-roll-number" label="Roll Number" value={draft.roll_number} required onChange={(value) => update("roll_number", value)} />
                  <ProfileField id="profile-semester" label="Semester" value={draft.semester} required onChange={(value) => update("semester", value)} />
                  <ProfileField id="profile-academic-year" label="Academic year" value={draft.academic_year} required onChange={(value) => update("academic_year", value)} />
                </>
              )}
              {(isTeacher || isCleaner || isOtherStaff) && (
                <ProfileField id="profile-staff-id" label="Staff ID" value={draft.staff_id} required onChange={(value) => update("staff_id", value)} />
              )}
              {isTeacher && (
                <>
                  <label htmlFor="profile-subjects" className="block text-sm font-semibold text-ink/75">
                    Subjects
                    <textarea id="profile-subjects" required value={draft.subjects} onChange={(event) => update("subjects", event.target.value)} placeholder="Separate subjects with commas" className="mt-2 w-full rounded-xl border border-border bg-card px-3.5 py-3 text-base font-normal text-foreground" />
                  </label>
                  <ProfileField id="profile-staff-room" label="Staff room" value={draft.staff_room} required onChange={(value) => update("staff_room", value)} />
                </>
              )}
              {isCleaner && (
                <>
                  <ProfileField id="profile-cleaning-area" label="Cleaning department / area" value={draft.cleaning_area} required onChange={(value) => update("cleaning_area", value)} />
                  <ProfileField id="profile-equipment-room" label="Equipment room" value={draft.equipment_room} required onChange={(value) => update("equipment_room", value)} />
                  <ProfileField id="profile-rest-room" label="Rest / break room" value={draft.rest_room} required onChange={(value) => update("rest_room", value)} />
                </>
              )}
              {isOtherStaff && (
                <>
                  <ProfileField id="profile-job-role" label="Job role" value={draft.job_role} required onChange={(value) => update("job_role", value)} />
                  <ProfileField id="profile-work-location" label="Work location" value={draft.work_location} required onChange={(value) => update("work_location", value)} />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-3 border-t border-border pt-5">
              <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                <Check size={16} aria-hidden="true" /> {saving ? "Saving profile…" : "Save profile"}
              </button>
              <button type="button" onClick={() => { setDraft(toDraft(profile)); setAvatarFile(null); setEditing(false); }} className="min-h-11 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="mt-8 grid gap-8 border-t border-border pt-7 lg:grid-cols-2">
        <div>
          <SectionHeading title="My Lost Items" action="Report lost" to="/report-lost" />
          <ItemSection items={lostItems} emptyTitle="No active lost reports" emptyDescription="Report a lost item to start finding it." emptyAction="Report a lost item" to="/report-lost" />
        </div>
        <div>
          <SectionHeading title="My Found Items" action="Report found" to="/report-found" />
          <ItemSection items={foundItems} emptyTitle="No found reports yet" emptyDescription="Record a found item so its owner can claim it." emptyAction="Report a found item" to="/report-found" />
        </div>
      </section>

      <section className="mt-8 border-t border-border pt-7">
        <SectionHeading title="My Claims" action="View all reports" to="/my-reports" />
        {claims.length ? (
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {claims.slice(0, 4).map((claim) => {
              const conversation = conversations.find((entry) => entry.claim_id === claim.claim_id);
              return (
                <div key={claim.claim_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold">{claim.item_title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{claim.is_claimant ? "Your submitted claim" : "Claim on your report"} · {CLAIM_STATUS_LABEL[claim.claim_status]}</p>
                  </div>
                  <div className="flex gap-2">
                    {conversation && <Link to="/messages/$conversationId" params={{ conversationId: conversation.conversation_id }} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Open chat</Link>}
                    <Link to="/items/$itemId" params={{ itemId: claim.item_id }} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Item details</Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState title="No claims yet" description="Claims you submit for found items will appear here." action="Browse found items" to="/found" />}
      </section>

      <section className="mt-8 border-t border-border pt-7">
        <SectionHeading title="My Conversations" action="Open messages" to="/messages" />
        {conversations.length ? (
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {conversations.slice(0, 4).map((conversation) => (
              <Link key={conversation.conversation_id} to="/messages/$conversationId" params={{ conversationId: conversation.conversation_id }} className="flex items-center gap-3 p-4 hover:bg-muted">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-board/10 font-semibold text-board">{conversation.other_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{conversation.item_title} <span className="font-normal text-muted-foreground">· {conversation.other_name}</span></p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{conversation.last_message ?? "No messages yet"}</p>
                </div>
                {conversation.unread_count > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">{conversation.unread_count}</span>}
                <ArrowUpRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : <EmptyState title="No conversations yet" description="An authorized chat will appear here when you submit a claim." action="Browse found items" to="/found" />}
      </section>
      {(itemsQuery.isError || claimsQuery.isError || conversationsQuery.isError) && (
        <p role="alert" className="mt-6 text-sm text-destructive">Some dashboard information could not be loaded. Refresh to try again.</p>
      )}
    </div>
  );
}

function Summary({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs font-semibold uppercase tracking-wide">{label}</span>{icon}</div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}

function SectionHeading({ title, action, to }: { title: string; action: string; to: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">{action}<ArrowUpRight size={15} aria-hidden="true" /></Link>
    </div>
  );
}

function ItemSection({
  items,
  emptyTitle,
  emptyDescription,
  emptyAction,
  to,
}: {
  items: Awaited<ReturnType<typeof fetchMyItems>>;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction: string;
  to: "/report-lost" | "/report-found";
}) {
  return items.length ? (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card">
      {items.slice(0, 3).map((item) => (
        <Link key={item.id} to="/items/$itemId" params={{ itemId: item.id }} className="flex items-center justify-between gap-3 p-4 hover:bg-muted">
          <span className="min-w-0"><span className="block truncate font-semibold">{item.title}</span><span className="mt-1 block text-sm text-muted-foreground">{ITEM_STATUS_LABEL[item.itemStatus ?? "open"]}</span></span>
          <ArrowUpRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      ))}
    </div>
  ) : <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} to={to} />;
}

function EmptyState({ title, description, action, to }: { title: string; description: string; action: string; to: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Link to={to} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">{action}<ArrowUpRight size={15} aria-hidden="true" /></Link>
    </div>
  );
}