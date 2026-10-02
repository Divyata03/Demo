import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { ConversationList } from "@/components/conversation-list";
import { useAuth } from "@/hooks/use-auth";
import { useConversations } from "@/hooks/use-conversations";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — CampusFind" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const conversationsQuery = useConversations(user?.id);
  const conversations = conversationsQuery.data ?? [];

  if (pathname.startsWith("/messages/") && pathname !== "/messages/") return <Outlet />;
  if (loading) return <div className="px-5 py-20 text-center text-muted-foreground">Loading messages…</div>;
  if (!user) return <SignInPrompt next="/messages" action="view your conversations" />;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-sm font-semibold text-primary">Private item conversations</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Messages</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Messages stay connected to an authorized claim and are visible only to its participants.</p>
        </div>
        <Link to="/profile" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
          My profile <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {conversationsQuery.isLoading ? (
        <div className="mt-6 animate-pulse rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading conversations…</div>
      ) : conversationsQuery.isError ? (
        <p role="alert" className="mt-6 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">We couldn't load your conversations. Please try again.</p>
      ) : conversations.length ? (
        <div className="mt-6 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <ConversationList conversations={conversations} />
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/50 px-6 py-12 text-center">
          <MessageCircle className="mx-auto text-primary" size={28} aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-semibold">No conversations yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">When you submit a valid claim for a found item, a private conversation with its reporter will appear here.</p>
          <Link to="/found" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Browse found items <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      )}
    </div>
  );
}