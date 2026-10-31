import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ArrowRight, CheckCircle2, MapPin, MessageSquare, Sparkles } from "lucide-react";

const pillars = [
  {
    icon: MessageSquare,
    title: "Reviews that stay human",
    copy: "Gemini drafts replies in your tone. You approve. Nothing fake gets published.",
  },
  {
    icon: Sparkles,
    title: "Profiles that convert",
    copy: "Descriptions, categories, posts, and photos — optimized without keyword spam.",
  },
  {
    icon: MapPin,
    title: "Local businesses, one desk",
    copy: "Switch locations instantly. Tenant isolation is built in from day one.",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 soft-grid opacity-70" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <BrandMark />
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-ink-500 hover:text-ink-900">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700"
          >
            Start free
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-16">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-leaf-100 bg-leaf-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-leaf-700">
            <Sparkles size={14} /> AI for Google Business Profile
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink-900 sm:text-6xl">
            Run every location from one calm desk.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-500">
            VyapaarAI helps local brands manage reviews, posts, SEO, and profile health —
            with Gemini, and with a clear path to live Google APIs when your access is approved.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-leaf-500 px-5 py-3 text-sm font-semibold text-white shadow-soft hover:bg-leaf-600"
            >
              Open demo workspace <ArrowRight size={16} />
            </Link>
            <p className="flex items-center gap-2 text-sm text-ink-500">
              <CheckCircle2 size={16} className="text-leaf-500" /> Demo login ready with Rajveer Chinese data
            </p>
          </div>
        </div>

        <div className="surface relative overflow-hidden rounded-[28px] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-500">Rajveer Chinese · Vadjal</p>
              <p className="mt-1 font-display text-2xl font-semibold">Profile health 82</p>
            </div>
            <span className="rounded-full bg-leaf-50 px-3 py-1 text-xs font-semibold text-leaf-700">App score</span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              ["4.2", "Avg rating"],
              ["12", "Reviews"],
              ["3", "Unanswered"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-paper-100 p-4">
                <p className="font-display text-2xl font-semibold">{value}</p>
                <p className="mt-1 text-xs text-ink-400">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {["Reply to negative review from Kavita", "Publish weekend Schezwan offer", "Add dessert services"].map(
              (item) => (
                <div key={item} className="rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm text-ink-700">
                  {item}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-3">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <article key={pillar.title} className="surface rounded-[28px] p-6">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-leaf-50 text-leaf-600">
                <Icon size={18} />
              </div>
              <h2 className="font-display text-xl font-semibold">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{pillar.copy}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
