import { supabase } from "@/integrations/supabase/client";
import type { Category, Item, ItemStatus } from "@/data/items";
import type { Tables } from "@/integrations/supabase/types";

type ItemRow = Tables<"items">;
const ITEM_PUBLIC_SELECT =
  "id, kind, title, category, description, photo_url, location, occurred_at, reporter_name, reporter_role, status, created_at";
const ITEM_AUTHENTICATED_SELECT = `${ITEM_PUBLIC_SELECT}, is_hidden`;

export type CampusRole = "student" | "teacher" | "security" | "cleaning_staff" | "other_staff";

export const ROLE_LABEL: Record<CampusRole, string> = {
  student: "Student",
  teacher: "Teacher",
  security: "Security",
  cleaning_staff: "Cleaning staff",
  other_staff: "Other college staff",
};

export const ITEM_STATUS_LABEL = {
  open: "Still on the board",
  claimed: "Being claimed",
  returned: "Returned",
} as const;

export const CLAIM_STATUS_LABEL = {
  pending: "Verification pending",
  approved: "Approved",
  rejected: "Verification rejected",
  handover_pending: "Handover pending",
  returned: "Returned",
} as const;

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} week${w === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

async function mapItemRows(
  data: Pick<
    ItemRow,
    | "id"
    | "kind"
    | "title"
    | "category"
    | "description"
    | "photo_url"
    | "location"
    | "occurred_at"
    | "reporter_name"
    | "reporter_role"
    | "status"
    | "created_at"
    | "is_hidden"
  >[],
): Promise<Item[]> {
  const paths = data.map((row) => row.photo_url).filter((path): path is string => !!path);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from("item-photos")
      .createSignedUrls(paths, 3600);
    signed?.forEach(
      (result) => result.path && result.signedUrl && urls.set(result.path, result.signedUrl),
    );
  }
  return data.map((row) => ({
    id: row.id,
    status: row.kind,
    category: row.category as Category,
    title: row.title,
    location: row.location,
    time: timeAgo(row.occurred_at ?? row.created_at),
    description: row.description ?? undefined,
    photoUrl: row.photo_url ? urls.get(row.photo_url) : undefined,
    reporter: row.reporter_name
      ? `${row.reporter_name}${row.reporter_role ? ` · ${ROLE_LABEL[row.reporter_role as CampusRole]}` : ""}`
      : undefined,
    occurredAt: row.occurred_at ?? undefined,
    createdAt: row.created_at,
    itemStatus: row.status,
    isHidden: row.is_hidden ?? false,
  }));
}

/** Fetch board items. Only safe, public columns are selected — never emails. */
export async function fetchItems(opts: {
  kind?: ItemStatus | undefined;
  category?: string | undefined;
  search?: string | undefined;
  location?: string | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  itemStatus?: "open" | "claimed" | "returned" | undefined;
  includeHidden?: boolean | undefined;
  limit?: number | undefined;
}): Promise<Item[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const canReadOwnerFields = !!sessionData.session?.user;
  let q = supabase
    .from("items")
    .select(canReadOwnerFields ? ITEM_AUTHENTICATED_SELECT : ITEM_PUBLIC_SELECT)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 60);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.itemStatus) q = q.eq("status", opts.itemStatus);
  if (canReadOwnerFields && !opts.includeHidden) q = q.eq("is_hidden", false);
  const location = opts.location?.trim().replace(/[%,()*]/g, " ");
  if (location) q = q.ilike("location", `%${location}%`);
  if (opts.fromDate) q = q.gte("occurred_at", `${opts.fromDate}T00:00:00`);
  if (opts.toDate) {
    const end = new Date(`${opts.toDate}T00:00:00`);
    end.setDate(end.getDate() + 1);
    q = q.lt("occurred_at", end.toISOString());
  }
  const s = opts.search?.trim().replace(/[%,()*]/g, " ");
  if (s) {
    q = q.or(
      `title.ilike.%${s}%,description.ilike.%${s}%,location.ilike.%${s}%,category.ilike.%${s}%`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;

  return mapItemRows(data);
}

export async function fetchItem(itemId: string): Promise<Item | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("items")
    .select(sessionData.session?.user ? ITEM_AUTHENTICATED_SELECT : ITEM_PUBLIC_SELECT)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await mapItemRows([data]))[0] ?? null;
}

export async function fetchMyItems(): Promise<Item[]> {
  const { data, error } = await supabase.rpc("get_my_items");
  if (error) throw error;
  return mapItemRows(data);
}

export async function isItemReporter(itemId: string) {
  const { data, error } = await supabase.rpc("is_item_reporter", { p_item_id: itemId });
  if (error) throw error;
  return data;
}

export async function fetchClaimsForItems(itemIds: string[]) {
  if (!itemIds.length) return [];
  const { data, error } = await supabase
    .from("claims")
    .select(
      "id, item_id, claimant_id, verification_details, status, review_note, reviewer_id, created_at, reviewed_at",
    )
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchClaimsForItem(itemId: string) {
  return fetchClaimsForItems([itemId]);
}

export async function fetchHandoversForClaims(claimIds: string[]) {
  if (!claimIds.length) return [];
  const { data, error } = await supabase
    .from("handovers")
    .select(
      "claim_id, claimant_confirmed, finder_confirmed, staff_confirmed, evidence, started_at, completed_at",
    )
    .in("claim_id", claimIds);
  if (error) throw error;
  return data;
}

export async function fetchContactRequestsForItems(itemIds: string[]) {
  if (!itemIds.length) return [];
  const { data, error } = await supabase
    .from("contact_requests")
    .select("id, item_id, requester_id, message, created_at")
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_id, kind, claim_id, item_id, created_at, read_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return data;
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, campus_role, department, phone, semester, academic_year, staff_id, roll_number, subjects, staff_room, cleaning_area, equipment_room, rest_room, job_role, work_location, avatar_path, created_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type MyClaimSummary = Awaited<ReturnType<typeof fetchMyClaimSummaries>>[number];

export async function fetchMyClaimSummaries() {
  const { data, error } = await supabase.rpc("get_my_claim_summaries");
  if (error) throw error;
  return data;
}

export type ConversationSummary = Awaited<ReturnType<typeof fetchMyConversations>>[number];

export async function fetchMyConversations() {
  const { data, error } = await supabase.rpc("get_my_conversations");
  if (error) throw error;
  const photoPaths = [...new Set(data.map((row) => row.item_photo_path).filter(Boolean))];
  const signedPhotos = new Map<string, string>();
  if (photoPaths.length) {
    const { data: signed } = await supabase.storage
      .from("item-photos")
      .createSignedUrls(photoPaths, 3600);
    signed?.forEach((result) => {
      if (result.path && result.signedUrl) signedPhotos.set(result.path, result.signedUrl);
    });
  }
  const avatarPaths = [...new Set(data.map((row) => row.other_avatar_path).filter(Boolean))];
  const signedAvatars = new Map<string, string>();
  if (avatarPaths.length) {
    const { data: signed } = await supabase.storage
      .from("profile-photos")
      .createSignedUrls(avatarPaths, 3600);
    signed?.forEach((result) => {
      if (result.path && result.signedUrl) signedAvatars.set(result.path, result.signedUrl);
    });
  }
  return data.map((row) => ({
    ...row,
    item_photo_url: row.item_photo_path ? signedPhotos.get(row.item_photo_path) ?? null : null,
    other_avatar_url: row.other_avatar_path ? signedAvatars.get(row.other_avatar_path) ?? null : null,
  }));
}

export async function fetchConversationMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, message_text, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchConversationMeetings(conversationId: string) {
  const { data, error } = await supabase
    .from("meeting_proposals")
    .select("id, conversation_id, proposed_by, location, starts_at, status, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function sendConversationMessage(conversationId: string, messageText: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to send a message.");
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: auth.user.id,
    message_text: messageText.trim(),
  });
  if (error) throw error;
}

export async function markConversationMessagesRead(conversationId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", auth.user.id)
    .is("read_at", null);
  if (error) throw error;
  const { data: conversation } = await supabase
    .from("conversations")
    .select("claim_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (conversation?.claim_id) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", auth.user.id)
      .eq("claim_id", conversation.claim_id)
      .eq("kind", "message_received")
      .is("read_at", null);
  }
}

export async function suggestConversationMeeting(
  conversationId: string,
  location: string,
  startsAt: string,
) {
  const { error } = await supabase.rpc("suggest_conversation_meeting", {
    p_conversation_id: conversationId,
    p_location: location.trim(),
    p_starts_at: startsAt,
  });
  if (error) throw error;
}

export async function respondToConversationMeeting(meetingId: string, action: "accept" | "cancel") {
  const { error } = await supabase.rpc("respond_to_conversation_meeting", {
    p_meeting_id: meetingId,
    p_action: action,
  });
  if (error) throw error;
}

export async function createProfileAvatarUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("profile-photos")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeProfileAvatar(path: string) {
  const { error } = await supabase.storage.from("profile-photos").remove([path]);
  if (error) throw error;
}

export async function saveMyProfile(profile: {
  full_name: string;
  department: string | null;
  phone: string | null;
  semester: string | null;
  academic_year: string | null;
  staff_id: string | null;
  roll_number: string | null;
  subjects: string[];
  staff_room: string | null;
  cleaning_area: string | null;
  equipment_room: string | null;
  rest_room: string | null;
  job_role: string | null;
  work_location: string | null;
  avatar_path: string | null;
}) {
  const { error } = await supabase.rpc("save_my_profile", {
    p_full_name: profile.full_name,
    p_department: profile.department,
    p_phone: profile.phone,
    p_semester: profile.semester,
    p_academic_year: profile.academic_year,
    p_staff_id: profile.staff_id,
    p_roll_number: profile.roll_number,
    p_subjects: profile.subjects,
    p_staff_room: profile.staff_room,
    p_cleaning_area: profile.cleaning_area,
    p_equipment_room: profile.equipment_room,
    p_rest_room: profile.rest_room,
    p_job_role: profile.job_role,
    p_work_location: profile.work_location,
    p_avatar_path: profile.avatar_path,
  });
  if (error) throw error;
}

export async function uploadProfileAvatar(userId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Profile photos must be under 5 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("profile-photos").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function submitClaim(itemId: string, verificationDetails: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before submitting a claim.");
  const { data, error } = await supabase
    .from("claims")
    .insert({
      item_id: itemId,
      claimant_id: auth.user.id,
      verification_details: verificationDetails.trim(),
    })
    .select("id, status")
    .single();
  if (error) throw error;
  return data;
}

export async function submitContactRequest(itemId: string, message: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before contacting about an item.");
  const { error } = await supabase.from("contact_requests").insert({
    item_id: itemId,
    requester_id: auth.user.id,
    message: message.trim(),
  });
  if (error) throw error;
}

export async function submitFeedback(claimId: string, rating: number, comment: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before leaving feedback.");
  const { error } = await supabase.from("feedback").insert({
    claim_id: claimId,
    author_id: auth.user.id,
    rating,
    comment: comment.trim() || null,
  });
  if (error) throw error;
}

export async function isCampusStaff() {
  const { data, error } = await supabase.rpc("is_campus_staff");
  if (error) throw error;
  return data;
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function reviewClaim(claimId: string, approved: boolean, note: string) {
  const { error } = await supabase.rpc("review_claim", {
    p_claim_id: claimId,
    p_approved: approved,
    p_note: note.trim() || null,
  });
  if (error) throw error;
}

export async function confirmHandover(claimId: string) {
  const { error } = await supabase.rpc("confirm_handover", { p_claim_id: claimId });
  if (error) throw error;
}

export async function saveHandoverEvidence(claimId: string, evidence: string) {
  const { error } = await supabase.rpc("save_handover_evidence", {
    p_claim_id: claimId,
    p_evidence: evidence,
  });
  if (error) throw error;
}

export async function completeHandover(claimId: string) {
  const { error } = await supabase.rpc("complete_handover", { p_claim_id: claimId });
  if (error) throw error;
}

export async function moderateItem(itemId: string, hidden: boolean) {
  const { error } = await supabase.rpc("moderate_item", {
    p_item_id: itemId,
    p_hidden: hidden,
  });
  if (error) throw error;
}

export async function saveProfileName(fullName: string) {
  const { error } = await supabase.rpc("save_profile_name", { p_full_name: fullName });
  if (error) throw error;
}

export async function createItem(input: {
  kind: ItemStatus;
  title: string;
  category: Category;
  description?: string | undefined;
  location: string;
  occurredAt?: string | undefined;
  photo?: File | null | undefined;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Please sign in first.");
  let photo_url: string | null = null;
  if (input.photo && input.photo.size > 0) {
    if (input.photo.size > 5 * 1024 * 1024) throw new Error("Photo must be under 5 MB.");
    const ext = input.photo.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("item-photos")
      .upload(path, input.photo, { contentType: input.photo.type });
    if (error) throw new Error("The photo could not be uploaded. Try a smaller picture.");
    photo_url = path;
  }
  const { error } = await supabase.from("items").insert({
    kind: input.kind,
    title: input.title,
    category: input.category,
    description: input.description || null,
    location: input.location,
    occurred_at: input.occurredAt || null,
    photo_url,
  });
  if (error) {
    if (photo_url) await supabase.storage.from("item-photos").remove([photo_url]);
    throw new Error("We couldn't save your report. Please try again.");
  }
}

export async function fetchMyFeedback(claimId: string, userId: string) {
  const { data, error } = await supabase
    .from("feedback")
    .select("id, rating, comment, created_at")
    .eq("claim_id", claimId)
    .eq("author_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
