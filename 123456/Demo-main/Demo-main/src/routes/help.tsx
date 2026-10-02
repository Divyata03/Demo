import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "About & Help — CampusFind" },
      {
        name: "description",
        content:
          "How CampusFind works, who it's for, and answers to common questions about lost and found on campus.",
      },
      { property: "og:title", content: "About & Help — CampusFind" },
      {
        property: "og:description",
        content:
          "How CampusFind works, who it's for, and answers to common questions about lost and found on campus.",
      },
      { name: "twitter:title", content: "About & Help — CampusFind" },
      {
        name: "twitter:description",
        content:
          "How CampusFind works, who it's for, and answers to common questions about lost and found on campus.",
      },
    ],
  }),
  component: HelpPage,
});

const STEPS = [
  {
    n: 1,
    title: "Report it",
    text: "Lost something, or found something? Fill in the short form — what it is, where, and when. It takes under two minutes.",
  },
  {
    n: 2,
    title: "Check the board",
    text: "Browse lost and found reports by name, category, place, date, or status. CampusFind does not automatically match reports.",
  },
  {
    n: 3,
    title: "Reunite",
    text: "Found your item? Submit a private claim with details only its owner would know. Authorized staff review the claim and coordinate a recorded handover.",
  },
];

const FAQS = [
  {
    q: "Do I need an account to use CampusFind?",
    a: "You can browse without an account. Sign in is required to report an item, submit a claim, contact a reporter, or provide feedback.",
  },
  {
    q: "Who can use it?",
    a: "Students and college staff can create accounts. The selected campus role is not verified and does not grant staff permissions. Staff dashboard access is provisioned separately.",
  },
  {
    q: "Someone found my item. How do I get it back?",
    a: "Open the found item's detail page and submit a claim with private identifying details. Authorized staff review the information. Do not share passwords, payment details, or contact information in your claim.",
  },
  {
    q: "Should I write my phone number in a report?",
    a: "Please don't. Public item pages show no email address or phone number. Use the private item request or claim flow instead, and avoid adding contact information to report descriptions.",
  },
  {
    q: "I lost something during a college event. Does it still work?",
    a: "Yes. Just mention the event in the description, like “Career Fair, main hall”. Event volunteers often hand items in too.",
  },
  {
    q: "How long do items stay on the board?",
    a: "Automatic expiry and physical storage tracking are not available in CampusFind yet. Contact campus staff for handling of valuable items.",
  },
];

const TIPS = [
  "Report as soon as you notice — the sooner it's on the board, the better.",
  "Describe from the outside: colour, size, stickers, scratches.",
  "Never share phone numbers, ID numbers or room numbers in a public report.",
  "Hand found wallets, phones and ID cards straight to the security office.",
];

export function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-mustard/30 px-4 py-1.5 text-sm font-medium text-ink">
          <span aria-hidden="true" className="size-2 rounded-full bg-tomato" />
          About & Help
        </span>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          How CampusFind works
        </h1>
        <p className="mt-3 max-w-[52ch] text-lg text-ink/70">
          CampusFind is a shared lost-and-found notice board for students and college staff.
          Reporting and private requests require an account.
        </p>
      </div>

      {/* How it works */}
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-3xl border-2 border-ink/10 bg-white p-6">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-full bg-mustard font-display text-xl font-semibold text-ink"
            >
              {s.n}
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold">{s.title}</h2>
            <p className="mt-2 leading-relaxed text-ink/70">{s.text}</p>
          </li>
        ))}
      </ol>

      {/* Quick actions */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/report-lost"
          className="group flex items-center justify-between gap-4 rounded-3xl bg-tomato p-6 text-cream transition-transform hover:-translate-y-1"
        >
          <span className="font-display text-2xl font-semibold">I lost something</span>
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cream/15 font-display text-2xl transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
        <Link
          to="/report-found"
          className="group flex items-center justify-between gap-4 rounded-3xl bg-mustard p-6 text-ink transition-transform hover:-translate-y-1"
        >
          <span className="font-display text-2xl font-semibold">I found something</span>
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink/10 font-display text-2xl transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      </div>

      {/* FAQ */}
      <section className="mt-14 max-w-3xl">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Common questions</h2>
        <div className="mt-6 flex flex-col gap-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-3xl border-2 border-ink/10 bg-white px-6 py-4"
            >
              <summary className="cursor-pointer list-none font-display text-lg font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-xl text-ink/40 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Tips + contact */}
      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-board p-8 text-cream">
          <h2 className="font-display text-2xl font-semibold">Tips that help</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-cream/80">
            {TIPS.map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden="true" className="text-mustard">
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border-2 border-ink/10 bg-white p-8">
          <h2 className="font-display text-2xl font-semibold">Need a hand?</h2>
          <p className="mt-3 leading-relaxed text-ink/70">
            Need in-person help with an item or handover? Visit the security office or the admin
            front desk during working hours.
          </p>
          <p className="mt-4 rounded-2xl bg-cream p-4 text-sm text-ink/70">
            You can also ask at the Student Union — they're happy to help anyone post or browse the
            board.
          </p>
        </div>
      </section>
    </div>
  );
}
