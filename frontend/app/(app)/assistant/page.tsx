"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { AiFeedback } from "@/components/AiFeedback";
import { api } from "@/lib/api";

type Turn = { role: "you" | "digital_dukan"; text: string; feedback?: boolean };

const suggestions = [
  {
    title: "Improve description",
    prompt: "Improve my Google Business description for local SEO in Vadjal.",
    href: "/optimizer",
  },
  {
    title: "Start a Google Post",
    prompt: "Give me 3 Google Post ideas for this week’s Schezwan specials.",
    href: "/posts",
  },
  {
    title: "Reply to unanswered reviews",
    prompt: "Which unanswered reviews should I reply to first and why?",
    href: "/reviews",
  },
  {
    title: "Add website / CTA links",
    prompt: "Suggest the best website and Maps CTA links for my profile.",
    href: "/optimizer",
  },
  {
    title: "Profile completeness check",
    prompt: "What details are missing on my business profile right now?",
    href: "/audit",
  },
  {
    title: "Photo ideas",
    prompt: "What food photos should I upload next for better clicks?",
    href: "/posts",
  },
];

export default function AssistantPage() {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "digital_dukan",
      text: "Pick a suggestion below, or ask anything. I can guide profile, posts, and reviews — and I won’t claim Google was updated unless the backend confirms it.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function ask(message: string, asImprovement = false) {
    if (!message.trim()) return;
    if (!asImprovement) {
      setTurns((rows) => [...rows, { role: "you", text: message }]);
    } else {
      setTurns((rows) => [...rows, { role: "you", text: `Needs improvements: ${message}` }]);
    }
    setLoading(true);
    try {
      const data = await api<{ reply: string }>("/ai/assistant", {
        method: "POST",
        body: JSON.stringify({
          message: asImprovement
            ? `Improve your previous answer with these notes: ${message}`
            : message,
        }),
      });
      setTurns((rows) => [...rows, { role: "digital_dukan", text: data.reply, feedback: true }]);
    } catch (err) {
      setTurns((rows) => [
        ...rows,
        { role: "digital_dukan", text: err instanceof Error ? err.message : "Assistant unavailable" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("message") as HTMLInputElement;
    const message = input.value.trim();
    input.value = "";
    await ask(message);
  }

  return (
    <PageShell
      kicker="AI assistant"
      title="Talk to the workspace"
      description="Suggestion cards jump you into the right workflow. Chat stays available for anything else."
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {suggestions.map((item) => (
          <button
            key={item.title}
            onClick={() => ask(item.prompt)}
            className="surface rounded-[24px] p-5 text-left hover:border-leaf-500"
          >
            <p className="font-semibold text-ink-900">{item.title}</p>
            <p className="mt-2 text-sm text-ink-500">{item.prompt}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(item.href);
              }}
              className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-leaf-600"
            >
              Open section →
            </button>
          </button>
        ))}
      </div>

      <div className="surface rounded-[28px] p-6">
        <div className="space-y-4">
          {turns.map((turn, index) => (
            <div
              key={index}
              className={
                turn.role === "you"
                  ? "ml-12 rounded-2xl bg-leaf-50 p-4"
                  : "mr-12 rounded-2xl bg-paper-100 p-4"
              }
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{turn.role}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{turn.text}</p>
              {turn.role === "digital_dukan" && turn.feedback && index === turns.length - 1 && (
                <AiFeedback
                  busy={loading}
                  onApprove={() => undefined}
                  onImprove={(notes) => ask(notes, true)}
                />
              )}
            </div>
          ))}
        </div>
        <form onSubmit={onSubmit} className="mt-6 flex gap-3">
          <input
            name="message"
            placeholder="Ask Digital Dukan…"
            className="flex-1 rounded-full border border-paper-300 bg-white px-5 py-3 outline-none focus:border-leaf-500"
          />
          <button disabled={loading} className="rounded-full bg-leaf-500 px-5 py-3 font-semibold text-white">
            {loading ? "Thinking…" : "Send"}
          </button>
        </form>
      </div>
    </PageShell>
  );
}
