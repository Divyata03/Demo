import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { CLAIM_STATUS_LABEL, type ConversationSummary } from "@/lib/items";

export function ConversationList({
  conversations,
  selectedId,
}: {
  conversations: ConversationSummary[];
  selectedId?: string;
}) {
  if (!conversations.length) {
    return (
      <div className="px-5 py-12 text-center">
        <MessageCircle className="mx-auto text-muted-foreground" size={24} aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">No conversations yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Chats begin after a valid item claim.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {conversations.map((conversation) => {
        const initials = conversation.other_name
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        return (
          <li key={conversation.conversation_id}>
            <Link
              to="/messages/$conversationId"
              params={{ conversationId: conversation.conversation_id }}
              aria-current={selectedId === conversation.conversation_id ? "page" : undefined}
              className={
                "flex min-w-0 items-start gap-3 p-4 transition-colors hover:bg-muted " +
                (selectedId === conversation.conversation_id ? "bg-muted" : "")
              }
            >
              {conversation.item_photo_url ? (
                <img
                  src={conversation.item_photo_url}
                  alt=""
                  className="size-11 shrink-0 rounded-xl border border-border object-cover"
                />
              ) : conversation.other_avatar_url ? (
                <img
                  src={conversation.other_avatar_url}
                  alt=""
                  className="size-11 shrink-0 rounded-xl border border-border object-cover"
                />
              ) : (
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                  {initials || <MessageCircle size={17} aria-hidden="true" />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{conversation.item_title}</span>
                  {conversation.unread_count > 0 && (
                    <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                      {conversation.unread_count}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{conversation.other_name}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{conversation.last_message ?? "No messages yet"}</span>
                <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{CLAIM_STATUS_LABEL[conversation.claim_status]}</span>
                  <span className="shrink-0">{conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleDateString() : "New"}</span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}