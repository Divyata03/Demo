import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchNotifications, isCampusStaff, markNotificationRead } from "@/lib/items";

type NavItem = { to: string; label: string; exact?: boolean };

const NAV: NavItem[] = [
  { to: "/", label: "Home", exact: true },
  { to: "/lost", label: "Lost Items" },
  { to: "/found", label: "Found Items" },
  { to: "/help", label: "About / Help" },
];

const NOTIFICATION_LABEL: Record<string, string> = {
  claim_received: "A claim request was received",
  claim_approved: "Your claim was approved",
  claim_rejected: "Your claim was not approved",
  handover_request: "A handover needs confirmation",
  item_returned: "An item was marked returned",
  contact_request: "A private item request was received",
};

function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });
  const notifications = notificationsQuery.data ?? [];
  const unread = notifications.filter((notification) => !notification.read_at).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          title="Notifications"
          className="relative grid size-10 place-items-center rounded-full border-2 border-ink/15 text-ink"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-tomato px-1 text-[10px] font-bold text-cream">
              {unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-cream">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notificationsQuery.isError ? (
          <DropdownMenuItem disabled>Notifications are unavailable.</DropdownMenuItem>
        ) : notifications.length === 0 ? (
          <DropdownMenuItem disabled>No notifications yet.</DropdownMenuItem>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              onSelect={() => {
                if (!notification.read_at)
                  void markNotificationRead(notification.id).then(() =>
                    queryClient.invalidateQueries({ queryKey: ["notifications"] }),
                  );
                if (notification.item_id)
                  void navigate({ to: "/items/$itemId", params: { itemId: notification.item_id } });
              }}
              className="flex cursor-pointer flex-col items-start gap-1 whitespace-normal"
            >
              <span className="font-medium">
                {NOTIFICATION_LABEL[notification.kind] ?? "CampusFind update"}
              </span>
              <span className="text-xs text-ink/55">
                {new Date(notification.created_at).toLocaleString()}
                {!notification.read_at ? " · New" : ""}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountDropdown({ isStaff }: { isStaff: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="My account"
          title="My account"
          className="inline-flex items-center gap-2 rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-semibold text-ink"
        >
          <UserRound size={16} />
          Account
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-cream">
        <DropdownMenuItem asChild>
          <Link to="/my-reports">My Reports</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile">My Profile</Link>
        </DropdownMenuItem>
        {isStaff && (
          <DropdownMenuItem asChild>
            <Link to="/staff">Staff Dashboard</Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const staffQuery = useQuery({
    queryKey: ["is-campus-staff", user?.id],
    queryFn: isCampusStaff,
    enabled: !!user,
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await supabase.auth.signOut();
    await queryClient.invalidateQueries();
    navigate({ to: "/", replace: true });
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink/10 bg-cream">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-2xl bg-board font-display text-xl font-semibold text-cream"
          >
            C
          </span>
          <span className="font-display text-2xl font-semibold leading-none tracking-tight">
            CampusFind
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              className={
                "rounded-full px-4 py-2 text-sm font-medium transition-transform hover:-translate-y-0.5 " +
                (isActive(item.to, item.exact)
                  ? "bg-ink/10 text-ink"
                  : "text-ink/70 hover:text-ink")
              }
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/report-lost"
            className="ml-2 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
          >
            Report an item
          </Link>
          {user ? (
            <>
              <NotificationDropdown />
              <AccountDropdown isStaff={staffQuery.data === true} />
              <button
                type="button"
                onClick={signOut}
                className="ml-1 rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="ml-1 rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
            >
              Sign in
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          {user && <NotificationDropdown />}
          <button
            type="button"
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t-2 border-ink/10 bg-cream px-5 pb-5 pt-2 lg:hidden"
        >
          <ul className="flex flex-col gap-1">
            {[
              ...NAV,
              { to: "/report-lost", label: "Report Lost Item" },
              { to: "/report-found", label: "Report Found Item" },
              ...(user
                ? [
                    { to: "/my-reports", label: "My Reports" },
                    { to: "/profile", label: "My Profile" },
                  ]
                : []),
              ...(staffQuery.data ? [{ to: "/staff", label: "Staff Dashboard" }] : []),
            ].map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact ?? false }}
                  onClick={() => setOpen(false)}
                  className={
                    "block rounded-2xl px-4 py-3 text-base font-medium " +
                    (isActive(item.to, item.exact) ? "bg-ink/10 text-ink" : "text-ink/80")
                  }
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void signOut();
                  }}
                  className="block w-full rounded-2xl px-4 py-3 text-left text-base font-semibold text-tomato"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  to="/auth"
                  search={{ mode: "signin" }}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-base font-semibold text-tomato"
                >
                  Sign in / Create account
                </Link>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
