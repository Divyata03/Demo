import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-[40ch]">
            <span className="font-display text-2xl font-extrabold tracking-[-0.04em] text-white">
              CampusFind
            </span>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              A trusted campus lost-and-found system for students, staff, and residents to recover
              what's been lost while keeping every handoff safe and verified.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Link to="/lost" className="text-slate-300 transition-colors hover:text-white">
              Lost items
            </Link>
            <Link to="/found" className="text-slate-300 transition-colors hover:text-white">
              Found items
            </Link>
            <Link to="/report-lost" className="text-slate-300 transition-colors hover:text-white">
              Report lost
            </Link>
            <Link to="/report-found" className="text-slate-300 transition-colors hover:text-white">
              Report found
            </Link>
            <Link to="/help" className="text-slate-300 transition-colors hover:text-white">
              Help
            </Link>
          </nav>
        </div>
        <p className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-400">
          CampusFind · Reports and private requests are stored in the connected campus service.
          Public item pages do not show email addresses or phone numbers.
        </p>
      </div>
    </footer>
  );
}
