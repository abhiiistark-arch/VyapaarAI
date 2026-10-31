"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { api } from "@/lib/api";

type Overview = {
  stats: {
    average_rating: number;
    unanswered_reviews: number;
    published_posts: number;
    total_posts?: number;
  };
  tasks: { id: string; title: string; description: string; priority: string }[];
};

export default function AuditPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api<Overview>("/dashboard/overview").then(setData).catch(() => setData(null));
  }, []);

  return (
    <PageShell
      kicker="SEO & profile audit"
      title="An app score, labeled honestly"
      description="Completeness, photos, reviews, and posting consistency for Rajveer Chinese. Never presented as a Google ranking."
    >
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="surface rounded-[28px] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">VyapaarAI score</p>
          <p className="mt-3 font-display text-6xl font-semibold text-ink-900">82</p>
          <p className="mt-3 text-sm text-ink-500">Strong category + address. Gaps: photos, dessert services, faster negative replies.</p>
        </article>
        <article className="surface rounded-[28px] p-6">
          <h2 className="font-display text-xl font-semibold">Checklist</h2>
          <div className="mt-4 space-y-3">
            {(data?.tasks || []).map((task) => (
              <div key={task.id} className="rounded-2xl bg-paper-100 px-4 py-3">
                <p className="text-sm font-semibold">{task.title}</p>
                <p className="mt-1 text-sm text-ink-500">{task.description}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </PageShell>
  );
}
