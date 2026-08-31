import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Claude OpenAI - Instagram comment-to-DM automation",
  description:
    "Turn Instagram keyword comments into automatic private replies. Built for the people, by the people.",
};

const heroStats = [
  { value: "24/7", label: "Comment monitoring" },
  { value: "1", label: "DM per matched comment" },
  { value: "Instant", label: "Automated response" },
];

const flowSteps = [
  {
    eyebrow: "Connect",
    title: "Link your Instagram professional account",
    description:
      "Sign in by email and connect your Instagram account securely with one click.",
  },
  {
    eyebrow: "Build",
    title: "Pick a post, keywords, and the DM",
    description:
      "Create a campaign for a reel or post: the keyword to watch, the public reply, and the DM to send.",
  },
  {
    eyebrow: "Deliver",
    title: "Replies go out automatically",
    description:
      "Comments are detected instantly and processed seamlessly. Every send is queued, rate-limited, and logged.",
  },
];

const features = [
  "Email magic-link sign-in",
  "Multiple Instagram accounts",
  "Encrypted tokens at rest",
  "Automated reconciliation",
  "Queue-backed delivery worker",
  "Per-account rate limiting",
  "Tracked links with click stats",
  "DM logs with full status",
  "Built for the people, by the people",
];

/* Static, faithful copies of the real Overview and Dashboard screens, built in
   the app's own design tokens so what visitors see is what the app looks like. */

function AppWindow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-2 text-xs text-muted">{label}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

const overviewStats = [
  ["Views", "847.2K"],
  ["Reach", "612.4K"],
  ["Likes", "38.1K"],
  ["Comments", "4,204"],
  ["Saved", "9,712"],
  ["Shares", "2,340"],
];

const overviewPosts = [
  ["Spring drop reel", "214.8K", "9.1K", "Apr 3"],
  ["Restock haul", "88.4K", "5.2K", "Mar 28"],
  ["Behind the studio", "51.3K", "3.4K", "Mar 21"],
];

function OverviewPreview() {
  return (
    <AppWindow label="app / overview">
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Overview</h3>
          <p className="mt-1 text-xs text-muted">
            Recent — 24 posts from @studio.store
          </p>
        </div>
        <span className="rounded border border-border px-2 py-1 text-xs text-muted">
          Last 50
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {overviewStats.map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>

      <div className="mt-4 rounded border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-foreground">
            Followers over time
          </p>
          <p className="text-xs text-muted">
            48,210 <span className="text-success">+1,240</span> · 30d
          </p>
        </div>
        <svg
          viewBox="0 0 300 64"
          preserveAspectRatio="none"
          className="mt-3 h-16 w-full"
          aria-hidden="true"
        >
          <polyline
            points="0,54 43,49 86,51 129,40 171,36 214,26 257,20 300,9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="text-accent"
          />
        </svg>
      </div>

      <div className="mt-4 rounded border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-foreground">Posts</p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="pb-2 pr-3 font-medium">Post</th>
              <th className="pb-2 px-3 text-right font-medium">Views</th>
              <th className="pb-2 px-3 text-right font-medium">Likes</th>
              <th className="pb-2 pl-3 text-right font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {overviewPosts.map(([post, views, likes, date]) => (
              <tr key={post} className="border-b border-border last:border-0">
                <td className="py-2 pr-3 text-foreground">{post}</td>
                <td className="py-2 px-3 text-right text-muted">{views}</td>
                <td className="py-2 px-3 text-right text-muted">{likes}</td>
                <td className="py-2 pl-3 text-right text-zinc-500">{date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppWindow>
  );
}

function MatchedCommentCard() {
  return (
    <div className="w-64 rounded-lg border border-border bg-surface p-4 shadow-2xl shadow-black/50">
      <p className="text-xs text-muted">New comment</p>
      <p className="mt-1 text-sm font-semibold text-foreground">@maya.co</p>
      <p className="mt-1 text-sm text-muted">LINK please</p>
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs text-muted">
          Matched <span className="text-accent">GUIDE</span>
        </p>
        <p className="mt-1 text-sm font-medium text-success">
          Queued private reply
        </p>
      </div>
    </div>
  );
}

const dashboardStats = [
  ["Active Campaigns", "8"],
  ["DMs Sent", "1,284"],
  ["Skipped", "42"],
  ["Failed", "3"],
  ["Clicks", "356"],
  ["CTR", "27.7%"],
];

const dashboardChart: [string, number][] = [
  ["Mon", 42],
  ["Tue", 68],
  ["Wed", 51],
  ["Thu", 94],
  ["Fri", 120],
  ["Sat", 86],
  ["Sun", 73],
];

const dashboardActivity = [
  ["@maya.co", "Product guide reply", "Sent", "text-success"],
  ["@founder.ray", "Price request", "Sent", "text-success"],
  ["@shop.ava", "Lead magnet", "Queued", "text-warning"],
];

function DashboardPreview() {
  const maxDM = Math.max(...dashboardChart.map(([, n]) => n));
  return (
    <AppWindow label="app / dashboard">
      <h3 className="text-base font-semibold text-foreground">Hello, Maya!</h3>
      <p className="mt-1 text-xs text-muted">2 connected accounts · 340 contacts</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {dashboardStats.map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>

      <div className="mt-4 rounded border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-foreground">DMs — Last 7 Days</p>
        <div className="mt-4 flex h-32 items-end gap-2">
          {dashboardChart.map(([day, n]) => (
            <div key={day} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] text-muted">{n}</span>
              <div
                className="w-full rounded-sm bg-accent"
                style={{ height: `${Math.max((n / maxDM) * 100, 4)}%` }}
              />
              <span className="text-[10px] text-zinc-500">{day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-foreground">Recent Activity</p>
        <div className="mt-3 space-y-2">
          {dashboardActivity.map(([user, automation, status, color]) => (
            <div
              key={user}
              className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0"
            >
              <span className="truncate text-foreground">{user}</span>
              <span className="truncate text-muted">{automation}</span>
              <span className={`text-sm ${color}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </AppWindow>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Claude OpenAI home">
            <span className="text-xl font-black tracking-tight text-zinc-900">Claude OpenAI</span>
          </Link>

          <div className="flex items-center gap-6">
            <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-zinc-600">
              <a href="#how" className="hover:text-zinc-900 transition-colors">How it works</a>
              <a href="#features" className="hover:text-zinc-900 transition-colors">Features</a>
            </nav>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-12 sm:px-6 sm:pt-18 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:pb-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-orange-700 uppercase">
            Built for the people, by the people
          </div>

          <h1 className="mt-7 text-balance text-5xl font-black leading-[1.05] tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl">
            Make every comment start the right DM
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            When someone comments your keyword on a post or reel, they get your DM a second later. Fast, reliable automation built for the people, by the people.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
            >
              Get started
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-6 py-3.5 text-sm font-bold text-zinc-900 transition hover:border-zinc-300 hover:bg-zinc-100"
            >
              See how it works
            </a>
          </div>

          <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <dt className="text-2xl font-black text-zinc-900">{stat.value}</dt>
                <dd className="mt-1 text-xs leading-5 text-zinc-500">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <OverviewPreview />
          <div className="absolute -bottom-8 -left-6 hidden lg:block">
            <MatchedCommentCard />
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-orange-600">How it works</p>
            <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight text-zinc-900 sm:text-5xl">
              A comment in, a DM out
            </h2>
            <p className="mt-5 text-base leading-8 text-zinc-600">
              Three simple steps. Connect an account, build your campaign, and let it run.
              Instant triggers handle comment replies live around the clock.
            </p>
          </div>

          <div className="grid gap-4">
            {flowSteps.map((step) => (
              <article
                key={step.title}
                className="grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-[120px_1fr]"
              >
                <p className="text-sm font-bold text-orange-600">{step.eyebrow}</p>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50 py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:items-center">
          <DashboardPreview />

          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-orange-600">The dashboard</p>
            <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight text-zinc-900 sm:text-5xl">
              See exactly what happened
            </h2>
            <p className="mt-5 text-base leading-8 text-zinc-600">
              Every comment event is traceable: queued, matched, sent, skipped, or delivered. Complete visibility and full control over your Instagram engagement.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-orange-600">What&rsquo;s included</p>
          <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight text-zinc-900 sm:text-5xl">
            Everything you need
          </h2>
          <p className="mt-5 text-base leading-8 text-zinc-600">
            Built for the people, by the people. Full access to powerful comment-to-DM automation tools without artificial limits.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold text-zinc-700"
            >
              {feature}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-xl border border-orange-200 bg-orange-50 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-zinc-900 sm:text-5xl">
              Turn your next reel&rsquo;s comments into DMs
            </h2>
            <p className="mt-4 text-base text-zinc-600">
              Start engaging with your followers automatically today.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-5 text-sm text-zinc-500 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 font-semibold text-zinc-700">
            <span>Claude OpenAI</span>
            <span>·</span>
            <span className="font-normal text-zinc-500">Built for the people, by the people</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-zinc-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-900 transition-colors">Terms</Link>
            <Link href="/login" className="hover:text-zinc-900 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
