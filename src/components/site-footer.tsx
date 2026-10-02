import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-board text-cream">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-[40ch]">
            <span className="font-display text-2xl font-semibold">CampusFind</span>
            <p className="mt-3 text-sm leading-relaxed text-cream/70">
              A shared lost-and-found notice board for students and college staff. Public listings
              avoid displaying account contact details.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Link
              to="/lost"
              className="text-cream/80 transition-transform hover:-translate-y-0.5 hover:text-cream"
            >
              Lost items
            </Link>
            <Link
              to="/found"
              className="text-cream/80 transition-transform hover:-translate-y-0.5 hover:text-cream"
            >
              Found items
            </Link>
            <Link
              to="/report-lost"
              className="text-cream/80 transition-transform hover:-translate-y-0.5 hover:text-cream"
            >
              Report lost
            </Link>
            <Link
              to="/report-found"
              className="text-cream/80 transition-transform hover:-translate-y-0.5 hover:text-cream"
            >
              Report found
            </Link>
            <Link
              to="/help"
              className="text-cream/80 transition-transform hover:-translate-y-0.5 hover:text-cream"
            >
              Help
            </Link>
          </nav>
        </div>
        <p className="mt-10 border-t border-cream/15 pt-6 text-xs text-cream/50">
          CampusFind · Reports and private requests are stored in the connected campus service.
          Public item pages do not show email addresses or phone numbers.
        </p>
      </div>
    </footer>
  );
}
