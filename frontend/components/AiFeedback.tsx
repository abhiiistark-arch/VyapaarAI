"use client";

import { useState } from "react";
import { Check, RefreshCw, Sparkles } from "lucide-react";

type Props = {
  onApprove: () => void;
  onImprove: (notes: string) => void | Promise<void>;
  /** One-click regenerate without notes */
  onRegenerate?: () => void | Promise<void>;
  busy?: boolean;
  label?: string;
  approveLabel?: string;
};

export function AiFeedback({
  onApprove,
  onImprove,
  onRegenerate,
  busy = false,
  label = "How is this AI draft?",
  approveLabel = "Looks good",
}: Props) {
  const [mode, setMode] = useState<"ask" | "improve" | "approved">("ask");
  const [notes, setNotes] = useState("");

  if (mode === "approved") {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-leaf-50 px-4 py-3 text-sm font-medium text-leaf-700">
        <Check size={16} /> Approved — you can still edit above before saving.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-paper-300 bg-paper-50 p-4">
      <p className="text-sm font-semibold text-ink-700">{label}</p>
      {mode === "ask" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onApprove();
              setMode("approved");
            }}
            className="inline-flex items-center gap-2 rounded-full bg-leaf-500 px-4 py-2 text-sm font-semibold text-white"
          >
            <Check size={16} /> {approveLabel}
          </button>
          {onRegenerate && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await onRegenerate();
                setMode("ask");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-leaf-500 bg-white px-4 py-2 text-sm font-semibold text-leaf-700"
            >
              <Sparkles size={16} /> {busy ? "Regenerating…" : "Regenerate"}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("improve")}
            className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700"
          >
            <RefreshCw size={16} /> Needs improvements
          </button>
        </div>
      )}
      {mode === "improve" && (
        <div className="mt-3 space-y-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What should change? e.g. brighter plating, less text on image, shorter caption…"
            className="w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !notes.trim()}
              onClick={async () => {
                await onImprove(notes.trim());
                setNotes("");
                setMode("ask");
              }}
              className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Improving…" : "Regenerate with notes"}
            </button>
            <button type="button" onClick={() => setMode("ask")} className="rounded-full px-4 py-2 text-sm text-ink-400">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
