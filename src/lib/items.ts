import { supabase } from "@/integrations/supabase/client";
import type { Category, Item, ItemStatus } from "@/data/items";
import type { Tables } from "@/integrations/supabase/types";

type ItemRow = Tables<"items">;
export type Conversation = Tables<"conversations">;
export type ChatMessage = Tables<"messages">;
const ITEM_PUBLIC_SELECT =
  "id, kind, title, category, description, photo_url, location, occurred_at, reporter_name, reporter_role, status, created_at";
const ITEM_AUTHENTICATED_SELECT = `${ITEM_PUBLIC_SELECT}, is_hidden`;

export type CampusRole = "student" | "teacher" | "security" | "cleaning_staff" | "other_staff";
export type ProfileUserType = "student" | "teacher" | "cleaner" | "other_staff";

export type ProfileSaveInput = {
  user_type: ProfileUserType;
  full_name: string;
  phone_number: string;
  student_roll_number?: string;
  employee_staff_id?: string;
  department?: string;
  semester?: string;
  academic_year?: string;
  subjects?: string[];
  staff_room_location?: string;
  cleaning_area?: string;
  equipment_room_location?: string;
  break_room_location?: string;
  job_role?: string;
  work_location?: string;
};

export const PROFILE_TYPE_LABEL: Record<ProfileUserType, string> = {
  student: "Student",
  teacher: "Teacher",
  cleaner: "Cleaner",
  other_staff: "Other Staff",
};

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
    .select("id, recipient_id, kind, claim_id, item_id, conversation_id, created_at, read_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return data;
}

export async function fetchUnreadNotificationCount(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

const CONVERSATION_SELECT =
  "id, claim_id, item_id, status, meeting_location, meeting_at, meeting_status, meeting_proposed_by, meeting_responded_by, created_at, updated_at";

export async function fetchConversation(conversationId: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchConversationSummary(conversationId: string) {
  const { data, error } = await supabase.rpc("get_conversation_summary", {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  const summary = data[0];
  if (!summary) return null;
  let itemPhotoUrl: string | null = null;
  if (summary.item_photo_path) {
    const { data: photo, error: photoError } = await supabase.storage
      .from("item-photos")
      .createSignedUrl(summary.item_photo_path, 3600);
    if (!photoError) itemPhotoUrl = photo.signedUrl;
  }
  return { ...summary, item_photo_url: itemPhotoUrl };
}

export async function getOrCreateConversation(claimId: string, itemId: string) {
  const existing = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("claim_id", claimId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase
    .from("conversations")
    .insert({ claim_id: claimId, item_id: itemId })
    .select(CONVERSATION_SELECT)
    .single();
  if (!created.error) return created.data;
  if (created.error.code === "23505") {
    const retry = await supabase
      .from("conversations")
      .select(CONVERSATION_SELECT)
      .eq("claim_id", claimId)
      .single();
    if (!retry.error) return retry.data;
  }
  throw created.error;
}

export async function fetchConversationMessages(conversationId: string, before?: string) {
  let query = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, message_text, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return data.reverse();
}

export async function sendConversationMessage(conversationId: string, text: string) {
  const messageText = text.trim();
  if (!messageText || messageText.length > 2000) {
    throw new Error("Messages must be between 1 and 2,000 characters.");
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to send a message.");
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: auth.user.id,
      message_text: messageText,
    })
    .select("id, conversation_id, sender_id, message_text, created_at, read_at")
    .single();
  if (error) throw error;
  return data;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const readAt = new Date().toISOString();
  const [messages, notifications] = await Promise.all([
    supabase
      .from("messages")
      .update({ read_at: readAt })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .is("read_at", null),
    supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("conversation_id", conversationId)
      .eq("recipient_id", userId)
      .is("read_at", null),
  ]);
  if (messages.error) throw messages.error;
  if (notifications.error) throw notifications.error;
}

export async function fetchUnreadConversationMessageCount(conversationId: string, userId: string) {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function proposeConversationMeeting(
  conversationId: string,
  location: string,
  meetingAt: string,
) {
  const { error } = await supabase.rpc("propose_conversation_meeting", {
    p_conversation_id: conversationId,
    p_location: location.trim(),
    p_meeting_at: meetingAt,
  });
  if (error) throw error;
}

export async function respondConversationMeeting(
  conversationId: string,
  response: "accepted" | "declined",
) {
  const { error } = await supabase.rpc("respond_conversation_meeting", {
    p_conversation_id: conversationId,
    p_response: response,
  });
  if (error) throw error;
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, college_email, campus_role, user_type, phone_number, student_roll_number, employee_staff_id, department, semester, academic_year, subjects, staff_room_location, cleaning_area, equipment_room_location, break_room_location, job_role, work_location, created_at, updated_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchClaimantProfiles(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  if (!uniqueIds.length) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, college_email, user_type, phone_number, student_roll_number, employee_staff_id, department, semester, academic_year, subjects, staff_room_location, cleaning_area, equipment_room_location, break_room_location, job_role, work_location",
    )
    .in("id", uniqueIds);
  if (error) throw error;
  return data;
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

export async function saveUserProfile(profile: ProfileSaveInput) {
  const { error } = await supabase.rpc("save_user_profile", { p_profile: profile });
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
