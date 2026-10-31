"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { api } from "@/lib/api";

type Automation = {
  enabled: boolean;
  auto_reply_positive: boolean;
  auto_ai_reply_enabled: boolean;
  require_approval_neutral: boolean;
  require_approval_negative: boolean;
  confidence_threshold: number;
  brand_tone: string;
  template_positive: string;
  auto_reply_min_rating: number;
  escalate_keywords: string;
  notify_email: boolean;
  notify_whatsapp: boolean;
  schedule_posts_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
};

const tones = ["friendly", "professional", "warm", "concise", "apologetic"];

export default function AutomationPage() {
  const [form, setForm] = useState<Automation | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api<Automation>("/automation")
      .then((data) =>
        setForm({
          ...data,
          auto_ai_reply_enabled: Boolean(data.auto_ai_reply_enabled),
        })
      )
      .catch((err) => setError(err.message));
  }, []);

  function toggle<K extends keyof Automation>(key: K, value: Automation[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const saved = await api<Automation>("/automation", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setForm(saved);
      setNote("Automation settings saved for this workspace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <PageShell kicker="Automation" title="Reply rules" description="Loading settings…">
        {error && <p className="text-sm text-red-600">{error}</p>}
      </PageShell>
    );
  }

  return (
    <PageShell
      kicker="Automation"
      title="Control what happens automatically"
      description="Positive auto-replies, approvals, escalation, quiet hours, and notifications — all editable before Google sync is live."
    >
      {note && <p className="mb-4 rounded-2xl bg-leaf-50 px-4 py-3 text-sm text-leaf-700">{note}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4">
        <section className="surface rounded-[28px] p-6 space-y-4">
          <h2 className="font-display text-xl font-semibold">Master switch</h2>
          <Toggle
            label="Enable automation"
            checked={form.enabled}
            onChange={(value) => toggle("enabled", value)}
          />
          <Toggle
            label="Automatic AI review replies"
            checked={form.auto_ai_reply_enabled}
            onChange={(value) => toggle("auto_ai_reply_enabled", value)}
          />
          <p className="text-xs text-ink-400">
            When on, eligible unanswered reviews get an AI draft reply and publish (respects approval + escalate rules).
          </p>
          <Toggle
            label="Template auto-reply for positive reviews"
            checked={form.auto_reply_positive}
            onChange={(value) => toggle("auto_reply_positive", value)}
          />
          <label className="block text-sm text-ink-500">
            Minimum stars for auto-reply
            <select
              value={form.auto_reply_min_rating}
              onChange={(e) => toggle("auto_reply_min_rating", Number(e.target.value))}
              className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3"
            >
              {[5, 4, 3].map((n) => (
                <option key={n} value={n}>
                  {n}+ stars
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={running || saving}
            onClick={async () => {
              setRunning(true);
              setError("");
              try {
                await api("/automation", { method: "PUT", body: JSON.stringify(form) });
                const result = await api<{ note: string; replied: number }>("/automation/run-review-replies", {
                  method: "POST",
                });
                setNote(result.note || `Replied to ${result.replied} reviews.`);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Run failed");
              } finally {
                setRunning(false);
              }
            }}
            className="rounded-full bg-leaf-500 px-4 py-2 text-sm font-semibold text-white"
          >
            {running ? "Running AI replies…" : "Run auto AI replies now"}
          </button>
        </section>

        <section className="surface rounded-[28px] p-6 space-y-4">
          <h2 className="font-display text-xl font-semibold">Approvals & safety</h2>
          <Toggle
            label="Neutral reviews need approval"
            checked={form.require_approval_neutral}
            onChange={(value) => toggle("require_approval_neutral", value)}
          />
          <Toggle
            label="Negative reviews need approval"
            checked={form.require_approval_negative}
            onChange={(value) => toggle("require_approval_negative", value)}
          />
          <label className="block text-sm text-ink-500">
            Confidence threshold ({Math.round(form.confidence_threshold * 100)}%)
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.05}
              value={form.confidence_threshold}
              onChange={(e) => toggle("confidence_threshold", Number(e.target.value))}
              className="mt-3 w-full"
            />
          </label>
          <label className="block text-sm text-ink-500">
            Escalate if review contains
            <input
              value={form.escalate_keywords}
              onChange={(e) => toggle("escalate_keywords", e.target.value)}
              className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3"
            />
          </label>
        </section>

        <section className="surface rounded-[28px] p-6 space-y-4">
          <h2 className="font-display text-xl font-semibold">Tone & template</h2>
          <label className="block text-sm text-ink-500">
            Brand tone
            <select
              value={form.brand_tone}
              onChange={(e) => toggle("brand_tone", e.target.value)}
              className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3"
            >
              {tones.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-ink-500">
            Positive reply template
            <textarea
              value={form.template_positive}
              onChange={(e) => toggle("template_positive", e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3"
            />
          </label>
        </section>

        <section className="surface rounded-[28px] p-6 space-y-4">
          <h2 className="font-display text-xl font-semibold">Notifications & schedule</h2>
          <Toggle
            label="Email notifications"
            checked={form.notify_email}
            onChange={(value) => toggle("notify_email", value)}
          />
          <Toggle
            label="WhatsApp notifications"
            checked={form.notify_whatsapp}
            onChange={(value) => toggle("notify_whatsapp", value)}
          />
          <Toggle
            label="Allow scheduled Google Posts"
            checked={form.schedule_posts_enabled}
            onChange={(value) => toggle("schedule_posts_enabled", value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-ink-500">
              Quiet hours start
              <input
                value={form.quiet_hours_start}
                onChange={(e) => toggle("quiet_hours_start", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3"
              />
            </label>
            <label className="block text-sm text-ink-500">
              Quiet hours end
              <input
                value={form.quiet_hours_end}
                onChange={(e) => toggle("quiet_hours_end", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3"
              />
            </label>
          </div>
        </section>

        <button disabled={saving} className="rounded-full bg-leaf-500 px-5 py-3 font-semibold text-white">
          {saving ? "Saving…" : "Save automation settings"}
        </button>
      </form>
    </PageShell>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl bg-paper-100 px-4 py-3">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
