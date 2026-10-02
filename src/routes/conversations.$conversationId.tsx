import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUp, CalendarClock, ChevronUp, MessageCircle } from "lucide-react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage } from "@/lib/items";
import {
  fetchConversation,
  fetchConversationMessages,
  fetchConversationSummary,
  markConversationRead,
  proposeConversationMeeting,
  respondConversationMeeting,
  sendConversationMessage,
} from "@/lib/items";

export const Route = createFileRoute("/conversations/$conversationId")({
  head: () => ({ meta: [{ title: "Conversation — CampusFind" }] }),
  component: ConversationPage,
});

const fieldClass =
  "w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-ink";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-cream disabled:opacity-50";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink/15 px-5 py-3 text-sm font-semibold disabled:opacity-50";

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [olderMessageState, setOlderMessageState] = useState<{
    scope: string;
    messages: ChatMessage[];
  }>({ scope: "", messages: [] });
  const [messageText, setMessageText] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState(false);
  const messageScope = `${user?.id ?? "anonymous"}:${conversationId}`;
  const queryKey = ["conversation-messages", conversationId, user?.id] as const;
  const olderMessages = olderMessageState.scope === messageScope ? olderMessageState.messages : [];

  const conversationQuery = useQuery({
    queryKey: ["conversation", conversationId, user?.id],
    queryFn: () => fetchConversation(conversationId),
    enabled: !!user,
  });
  const summaryQuery = useQuery({
    queryKey: ["conversation-summary", conversationId, user?.id],
    queryFn: () => fetchConversationSummary(conversationId),
    enabled: !!user && !!conversationQuery.data,
  });
  const messagesQuery = useQuery({
    queryKey,
    queryFn: () => fetchConversationMessages(conversationId),
    enabled: !!user && !!conversationQuery.data,
  });
  const messages = [...olderMessages, ...(messagesQuery.data ?? [])];
  const summary = summaryQuery.data;
  const conversation = conversationQuery.data;
  const unreadCount = messages.filter(
    (message) => message.sender_id !== user?.id && !message.read_at,
  ).length;
  const hasMore = (messagesQuery.data?.length ?? 0) === 50 && hasMoreOlder;
  const canSend =
    conversation?.status === "active" &&
    !!summary?.is_workflow_participant &&
    ["pending", "approved", "handover_pending"].includes(summary?.claim_status ?? "");

  useEffect(() => {
    setOlderMessageState({ scope: messageScope, messages: [] });
    setHasMoreOlder(true);
    setMessageText("");
    setError(null);
  }, [messageScope]);

  useEffect(() => {
    if (!user || !conversation) return;
    let active = true;
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          queryClient.setQueryData<ChatMessage[]>(queryKey, (current) => {
            if (!current || current.some((message) => message.id === incoming.id)) return current;
            return [...current, incoming];
          });
          if (incoming.sender_id !== user.id && summary?.is_workflow_participant) {
            void markConversationRead(conversationId, user.id)
              .then(() => {
                const readAt = new Date().toISOString();
                queryClient.setQueryData<ChatMessage[]>(queryKey, (current) =>
                  current?.map((message) =>
                    message.sender_id !== user.id && !message.read_at
                      ? { ...message, read_at: readAt }
                      : message,
                  ),
                );
                setOlderMessageState((current) =>
                  current.scope === messageScope
                    ? {
                        ...current,
                        messages: current.messages.map((message) =>
                          message.sender_id !== user.id && !message.read_at
                            ? { ...message, read_at: readAt }
                            : message,
                        ),
                      }
                    : current,
                );
                return Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["notifications"] }),
                  queryClient.invalidateQueries({ queryKey: ["unread-notification-count"] }),
                ]);
              })
              .catch(() => {
                if (active)
                  setError("A new message arrived, but its read status could not be updated.");
              });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
          void queryClient.invalidateQueries({
            queryKey: ["conversation-summary", conversationId],
          });
        },
      )
      .subscribe((status) => {
        if (!active) return;
        setRealtimeError(status === "CHANNEL_ERROR" || status === "TIMED_OUT");
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, user, conversation, summary]);

  useEffect(() => {
    if (
      !user ||
      !summary?.is_workflow_participant ||
      !messagesQuery.data?.some((message) => message.sender_id !== user.id && !message.read_at)
    )
      return;
    void markConversationRead(conversationId, user.id)
      .then(() => {
        const readAt = new Date().toISOString();
        queryClient.setQueryData<ChatMessage[]>(queryKey, (current) =>
          current?.map((message) =>
            message.sender_id !== user.id && !message.read_at
              ? { ...message, read_at: readAt }
              : message,
          ),
        );
        setOlderMessageState((current) =>
          current.scope === messageScope
            ? {
                ...current,
                messages: current.messages.map((message) =>
                  message.sender_id !== user.id && !message.read_at
                    ? { ...message, read_at: readAt }
                    : message,
                ),
              }
            : current,
        );
        return Promise.all([
          queryClient.invalidateQueries({ queryKey: ["notifications"] }),
          queryClient.invalidateQueries({ queryKey: ["unread-notification-count"] }),
        ]);
      })
      .catch(() => setError("Messages loaded, but unread status could not be updated."));
  }, [conversationId, messagesQuery.data, queryClient, user, summary]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageText.trim() || !canSend) return;
    setBusy(true);
    setError(null);
    try {
      const sent = await sendConversationMessage(conversationId, messageText);
      queryClient.setQueryData<ChatMessage[]>(queryKey, (current) => {
        if (!current || current.some((message) => message.id === sent.id)) return current;
        return [...current, sent];
      });
      setMessageText("");
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function loadOlder() {
    const first = messages[0];
    if (!first) return;
    setLoadingOlder(true);
    setError(null);
    try {
      const page = await fetchConversationMessages(conversationId, first.created_at);
      if (page.length < 50) setHasMoreOlder(false);
      setOlderMessageState((current) => ({
        scope: messageScope,
        messages: [...page, ...(current.scope === messageScope ? current.messages : [])],
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Older messages could not be loaded.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await proposeConversationMeeting(
        conversationId,
        meetingLocation,
        new Date(meetingAt).toISOString(),
      );
      setMeetingLocation("");
      setMeetingAt("");
      await queryClient.invalidateQueries({ queryKey: ["conversation-summary", conversationId] });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The meeting proposal could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function respond(response: "accepted" | "declined") {
    setBusy(true);
    setError(null);
    try {
      await respondConversationMeeting(conversationId, response);
      await queryClient.invalidateQueries({ queryKey: ["conversation-summary", conversationId] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your response could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return <PageMessage>Checking your sign-in…</PageMessage>;
  if (!user)
    return (
      <SignInPrompt next={`/conversations/${conversationId}`} action="open this conversation" />
    );
  if (conversationQuery.isLoading) return <PageMessage>Loading conversation…</PageMessage>;
  if (conversationQuery.isError || !conversation) {
    return (
      <PageMessage role="alert">
        This conversation is unavailable or you are not a participant.
      </PageMessage>
    );
  }
  if (summaryQuery.isLoading || messagesQuery.isLoading)
    return <PageMessage>Loading messages…</PageMessage>;
  if (summaryQuery.isError || messagesQuery.isError || !summary) {
    return (
      <PageMessage role="alert">We couldn’t load this conversation. Please try again.</PageMessage>
    );
  }

  const otherParticipant = summary.other_display_name || "Conversation participant";
  const meetingNeedsResponse =
    summary.meeting_status === "proposed" && summary.meeting_proposed_by !== user.id;
  const isClosed =
    conversation.status !== "active" ||
    summary.claim_status === "returned" ||
    summary.claim_status === "rejected";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        to="/items/$itemId"
        params={{ itemId: summary.item_id }}
        className="text-sm font-semibold text-tomato underline decoration-2 underline-offset-4"
      >
        Back to item and handover
      </Link>
      <section className="mt-5 overflow-hidden rounded-3xl border-2 border-ink/10 bg-white">
        <header className="flex items-center gap-3 border-b border-ink/10 p-4 sm:p-5">
          {summary.item_photo_url ? (
            <img
              src={summary.item_photo_url}
              alt=""
              className="size-14 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-cream text-ink/50">
              <MessageCircle aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-semibold">{summary.item_title}</h1>
            <p className="mt-0.5 text-sm text-ink/65">Chat with {otherParticipant}</p>
          </div>
          <span className="shrink-0 rounded-full bg-mustard/30 px-3 py-1 text-xs font-semibold">
            {isClosed
              ? summary.claim_status === "returned"
                ? "Handover complete"
                : "Closed"
              : "Active"}
          </span>
        </header>

        <div className="border-b border-ink/10 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Meeting Details</h2>
            {summary.meeting_status && summary.meeting_at && (
              <span className="text-xs font-semibold text-ink/60">
                {summary.meeting_status === "accepted"
                  ? "Agreed"
                  : summary.meeting_status === "declined"
                    ? "Declined"
                    : "Awaiting response"}
              </span>
            )}
          </div>
          {summary.meeting_location && summary.meeting_at ? (
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm text-ink/75">
                <CalendarClock aria-hidden="true" className="mr-1 inline size-4" />
                {summary.meeting_location} · {new Date(summary.meeting_at).toLocaleString()}
              </p>
              {meetingNeedsResponse && canSend && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void respond("accepted")}
                    className={primaryButton}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void respond("declined")}
                    className={secondaryButton}
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink/60">No meeting has been suggested.</p>
          )}
          {canSend && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold underline underline-offset-2">
                {summary.meeting_status ? "Suggest another time or place" : "Suggest a meeting"}
              </summary>
              <form
                onSubmit={(event) => void schedule(event)}
                className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  aria-label="Meeting location"
                  placeholder="Meeting location"
                  value={meetingLocation}
                  onChange={(event) => setMeetingLocation(event.target.value)}
                  className={fieldClass}
                />
                <input
                  required
                  type="datetime-local"
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  aria-label="Meeting date and time"
                  value={meetingAt}
                  onChange={(event) => setMeetingAt(event.target.value)}
                  className={fieldClass}
                />
                <button type="submit" disabled={busy} className={primaryButton}>
                  Suggest
                </button>
              </form>
            </details>
          )}
        </div>

        <div
          className="flex min-h-[45vh] max-h-[65vh] flex-col overflow-y-auto bg-cream/50 px-3 py-4 sm:px-5"
          aria-label="Messages"
        >
          {hasMore && (
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className={`${secondaryButton} mx-auto mb-4`}
            >
              <ChevronUp aria-hidden="true" size={16} />
              {loadingOlder ? "Loading…" : "Load older messages"}
            </button>
          )}
          {messages.length === 0 ? (
            <div className="m-auto max-w-sm py-10 text-center">
              <MessageCircle aria-hidden="true" className="mx-auto size-8 text-ink/35" />
              <p className="mt-3 font-semibold">Start the conversation</p>
              <p className="mt-1 text-sm text-ink/60">
                Discuss item details and coordinate a safe campus handover.
              </p>
            </div>
          ) : (
            <ol className="flex flex-col gap-3" aria-live="polite" aria-relevant="additions text">
              {messages.map((message) => {
                const own = message.sender_id === user.id;
                return (
                  <li
                    key={message.id}
                    className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${own ? "self-end rounded-br-sm bg-board text-cream" : "self-start rounded-bl-sm border border-ink/10 bg-white text-ink"}`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {message.message_text}
                    </p>
                    <p
                      className={`mt-1 text-right text-[11px] ${own ? "text-cream/65" : "text-ink/50"}`}
                    >
                      {new Date(message.created_at).toLocaleString()}
                      {own && message.read_at ? " · Read" : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <footer className="border-t border-ink/10 p-3 sm:p-4">
          {isClosed ? (
            <p className="text-center text-sm text-ink/60">
              This conversation is closed. Handover and claim records remain available to authorized
              participants and staff.
            </p>
          ) : !summary.is_workflow_participant ? (
            <p className="text-center text-sm text-ink/60">
              You can review this conversation as authorized campus staff. Only the claimant and
              item reporter can send messages.
            </p>
          ) : (
            <form onSubmit={(event) => void send(event)} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="conversation-message">
                Message
              </label>
              <textarea
                id="conversation-message"
                required
                maxLength={2000}
                rows={2}
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Write a message…"
                className={`${fieldClass} min-h-12 resize-y`}
              />
              <button
                type="submit"
                disabled={busy || !messageText.trim() || !canSend}
                aria-label="Send message"
                title="Send message"
                className={`${primaryButton} size-12 shrink-0 px-0`}
              >
                <ArrowUp aria-hidden="true" size={19} />
              </button>
            </form>
          )}
          {unreadCount > 0 && (
            <p className="mt-2 text-right text-xs text-ink/55">
              {unreadCount} unread message{unreadCount === 1 ? "" : "s"}
            </p>
          )}
          {realtimeError && (
            <p role="status" className="mt-2 text-xs text-tomato">
              Live updates disconnected. Messages can still be refreshed.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-tomato">
              {error}
            </p>
          )}
          {summary.meeting_status === "accepted" &&
            ["approved", "handover_pending"].includes(summary.claim_status) && (
              <Link
                to="/items/$itemId"
                params={{ itemId: summary.item_id }}
                className={`${secondaryButton} mt-3 w-full sm:w-auto`}
              >
                Proceed to Handover
              </Link>
            )}
        </footer>
      </section>
    </div>
  );
}

function PageMessage({ children, role }: { children: string; role?: "alert" }) {
  return (
    <div role={role} className="mx-auto max-w-3xl px-5 py-20 text-center text-ink/65">
      {children}
    </div>
  );
}
