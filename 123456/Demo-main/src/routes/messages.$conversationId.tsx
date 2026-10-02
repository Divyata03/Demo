import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowLeft, Check, CheckCheck, Clock3, MapPin, MessageCircle, Send } from "lucide-react";
import { ConversationList } from "@/components/conversation-list";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { useAuth } from "@/hooks/use-auth";
import { useConversations } from "@/hooks/use-conversations";
import { supabase } from "@/integrations/supabase/client";
import {
  CLAIM_STATUS_LABEL,
  fetchConversationMeetings,
  fetchConversationMessages,
  markConversationMessagesRead,
  respondToConversationMeeting,
  sendConversationMessage,
  suggestConversationMeeting,
} from "@/lib/items";

export const Route = createFileRoute("/messages/$conversationId")({
  head: () => ({ meta: [{ title: "Conversation — CampusFind" }] }),
  component: ConversationPage,
});

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [meetingFormOpen, setMeetingFormOpen] = useState(false);
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationsQuery = useConversations(user?.id);
  const conversations = conversationsQuery.data ?? [];
  const conversation = conversations.find((entry) => entry.conversation_id === conversationId);
  const messagesQuery = useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: () => fetchConversationMessages(conversationId),
    enabled: !!user && !!conversation,
  });
  const meetingsQuery = useQuery({
    queryKey: ["conversation-meetings", conversationId],
    queryFn: () => fetchConversationMeetings(conversationId),
    enabled: !!user && !!conversation,
  });
  const messages = messagesQuery.data ?? [];
  const meetings = meetingsQuery.data ?? [];
  const meeting = meetings[0];
  const canSend = conversation?.conversation_status === "open" && conversation.claim_status !== "rejected" && conversation.claim_status !== "returned";
  const minMeetingTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  useEffect(() => {
    if (!user || !conversation) return;
    const channel = supabase
      .channel(`conversation-thread-${conversationId}-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
          void queryClient.invalidateQueries({ queryKey: ["my-conversations", user.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_proposals", filter: `conversation_id=eq.${conversationId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["conversation-meetings", conversationId] });
          void queryClient.invalidateQueries({ queryKey: ["my-conversations", user.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation, conversationId, queryClient, user]);

  useEffect(() => {
    if (!user || !messages.some((message) => message.sender_id !== user.id && !message.read_at)) return;
    void markConversationMessagesRead(conversationId).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["my-conversations", user.id] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    }).catch(() => undefined);
  }, [conversationId, messages, queryClient, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || !canSend) return;
    setSending(true);
    setSendError(null);
    try {
      await sendConversationMessage(conversationId, text);
      setMessageText("");
      await queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
    } catch (caught) {
      setSendError(caught instanceof Error ? caught.message : "Your message couldn't be sent.");
    } finally {
      setSending(false);
    }
  }

  async function onSuggestMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meetingTime || !canSend) return;
    setMeetingBusy(true);
    setMeetingError(null);
    try {
      await suggestConversationMeeting(conversationId, meetingLocation, new Date(meetingTime).toISOString());
      setMeetingLocation("");
      setMeetingTime("");
      setMeetingFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["conversation-meetings", conversationId] });
    } catch (caught) {
      setMeetingError(caught instanceof Error ? caught.message : "The meeting suggestion couldn't be saved.");
    } finally {
      setMeetingBusy(false);
    }
  }

  async function onMeetingResponse(action: "accept" | "cancel") {
    if (!meeting) return;
    setMeetingBusy(true);
    setMeetingError(null);
    try {
      await respondToConversationMeeting(meeting.id, action);
      await queryClient.invalidateQueries({ queryKey: ["conversation-meetings", conversationId] });
    } catch (caught) {
      setMeetingError(caught instanceof Error ? caught.message : "The meeting couldn't be updated.");
    } finally {
      setMeetingBusy(false);
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  if (loading) return <div className="px-5 py-20 text-center text-muted-foreground">Loading conversation…</div>;
  if (!user) return <SignInPrompt next={`/messages/${conversationId}`} action="open this conversation" />;
  if (conversationsQuery.isLoading) return <div className="px-5 py-20 text-center text-muted-foreground">Loading conversation…</div>;
  if (!conversation)
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <MessageCircle className="mx-auto text-muted-foreground" size={30} aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Conversation unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">This conversation isn't available to your account.</p>
        <Link to="/messages" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"><ArrowLeft size={16} />Back to messages</Link>
      </div>
    );

  const initials = conversation.other_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const terminalClaim = conversation.claim_status === "returned" || conversation.claim_status === "rejected";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 py-3 sm:px-6 sm:py-5 md:min-h-[calc(100dvh-6rem)]">
      <div className="grid flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:min-h-[36rem] md:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="hidden overflow-y-auto border-r border-border md:block" aria-label="Your conversations">
          <div className="border-b border-border px-4 py-4">
            <h1 className="font-display text-xl font-semibold">Messages</h1>
            <p className="mt-1 text-xs text-muted-foreground">Private item conversations</p>
          </div>
          <ConversationList conversations={conversations} selectedId={conversationId} />
        </aside>

        <section className="flex min-h-[calc(100dvh-7rem)] min-w-0 flex-col md:min-h-0" aria-label={`Conversation about ${conversation.item_title}`}>
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <Link to="/messages" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-primary md:hidden"><ArrowLeft size={14} />All messages</Link>
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-sm font-bold text-primary" role="img" aria-label={`Avatar for ${conversation.other_name}`}>
                {conversation.other_avatar_url ? <img src={conversation.other_avatar_url} alt="" className="size-full object-cover" /> : initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{conversation.other_name}</p>
                <p className="truncate text-xs text-muted-foreground">{conversation.other_role.replaceAll("_", " ")}{conversation.other_department ? ` · ${conversation.other_department}` : ""}</p>
              </div>
              {conversation.item_photo_url && <img src={conversation.item_photo_url} alt="" className="size-10 shrink-0 rounded-lg border border-border object-cover" />}
              <div className="min-w-0 max-w-44">
                <p className="truncate text-sm font-semibold">{conversation.item_title}</p>
                <p className="truncate text-xs text-muted-foreground">{CLAIM_STATUS_LABEL[conversation.claim_status]}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{conversation.conversation_status === "open" ? "Claim conversation" : "Conversation closed"} · {CLAIM_STATUS_LABEL[conversation.claim_status]}</p>
              <Link to="/items/$itemId" params={{ itemId: conversation.item_id }} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">{["approved", "handover_pending"].includes(conversation.claim_status) ? "Proceed to handover" : "Open item details"}</Link>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-background/60 px-4 py-5 sm:px-6" aria-live="polite" aria-label="Messages">
            {messagesQuery.isLoading ? (
              <div className="space-y-3" aria-label="Loading messages"><div className="h-12 w-2/3 animate-pulse rounded-2xl bg-muted" /><div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-primary/10" /></div>
            ) : messagesQuery.isError ? (
              <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">Messages couldn't be loaded. Try again.</p>
            ) : messages.length === 0 ? (
              <div className="grid h-full min-h-44 place-items-center text-center">
                <div><MessageCircle className="mx-auto text-primary" size={28} aria-hidden="true" /><p className="mt-3 font-semibold">Start the conversation</p><p className="mt-1 text-sm text-muted-foreground">Coordinate privately about this item and its claim.</p></div>
              </div>
            ) : messages.map((message) => {
              const own = message.sender_id === user.id;
              return (
                <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                  <article className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${own ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-card text-foreground"}`}>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message_text}</p>
                    <p className={`mt-2 flex items-center justify-end gap-1 text-[11px] ${own ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                      {new Date(message.created_at).toLocaleString()}
                      {own && (message.read_at ? <><CheckCheck size={13} aria-hidden="true" /><span>Read</span></> : <><Check size={13} aria-hidden="true" /><span>Sent</span></>)}
                    </p>
                  </article>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border bg-card px-4 py-3 sm:px-5">
            {meeting && meeting.status !== "replaced" && (
              <div className="mb-3 rounded-xl border border-border bg-muted/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={15} aria-hidden="true" /> Meeting {meeting.status === "accepted" ? "confirmed" : meeting.status === "proposed" ? "suggestion" : meeting.status}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin size={14} aria-hidden="true" />{meeting.location}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{new Date(meeting.starts_at).toLocaleString()}</p>
                  </div>
                  {meeting.status === "proposed" && canSend && (
                    <div className="flex gap-2">
                      {meeting.proposed_by !== user.id && <button type="button" disabled={meetingBusy} onClick={() => void onMeetingResponse("accept")} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">Accept</button>}
                      <button type="button" disabled={meetingBusy} onClick={() => void onMeetingResponse("cancel")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60">Cancel</button>
                    </div>
                  )}
                </div>
                {meetingError && <p role="alert" className="mt-2 text-xs text-destructive">{meetingError}</p>}
              </div>
            )}
            {meetingFormOpen && canSend && (
              <form onSubmit={onSuggestMeeting} className="mb-3 grid gap-2 rounded-xl border border-border bg-muted/40 p-3 sm:grid-cols-[1fr_13rem_auto]">
                <label className="text-xs font-semibold">Meeting location<input required minLength={2} maxLength={160} value={meetingLocation} onChange={(event) => setMeetingLocation(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal" placeholder="Main college gate" /></label>
                <label className="text-xs font-semibold">Date and time<input required type="datetime-local" min={minMeetingTime} value={meetingTime} onChange={(event) => setMeetingTime(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal" /></label>
                <button type="submit" disabled={meetingBusy} className="self-end rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{meetingBusy ? "Saving…" : "Suggest"}</button>
                {meetingError && <p role="alert" className="text-xs text-destructive sm:col-span-3">{meetingError}</p>}
              </form>
            )}
            <div className="mb-2 flex justify-between">
              {canSend && <button type="button" onClick={() => { setMeetingError(null); setMeetingFormOpen((open) => !open); }} className="text-xs font-semibold text-primary hover:underline">{meetingFormOpen ? "Close meeting form" : meeting ? "Suggest another time" : "Suggest meeting details"}</button>}
              {meetingsQuery.isError && <span role="alert" className="text-xs text-destructive">Meeting details unavailable.</span>}
            </div>
            {canSend ? (
              <form onSubmit={onSend} className="flex items-end gap-2">
                <label htmlFor="chat-message" className="sr-only">Message</label>
                <textarea id="chat-message" value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={onComposerKeyDown} maxLength={4000} rows={2} placeholder="Write a message…" className="max-h-32 min-h-12 flex-1 resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground" />
                <button type="submit" disabled={sending || !messageText.trim()} aria-label="Send message" title="Send message" className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Send size={17} aria-hidden="true" /></button>
              </form>
            ) : (
              <p className="rounded-xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">This claim conversation is closed. The existing handover status remains on the item record.</p>
            )}
            {sendError && <p role="alert" className="mt-2 text-xs text-destructive">{sendError}</p>}
            {sending && <p className="mt-1 text-xs text-muted-foreground" role="status">Sending message…</p>}
          </div>
        </section>
      </div>
    </div>
  );
}