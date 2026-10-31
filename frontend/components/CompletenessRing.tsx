"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  percent: number;
  label?: string;
  size?: number;
  stroke?: number;
  loading?: boolean;
};

export function CompletenessRing({ percent, label, size = 168, stroke = 14, loading }: Props) {
  const target = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const [display, setDisplay] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (loading) return;
    let frame = 0;
    const start = display;
    const diff = target - start;
    const steps = 36;
    const tick = () => {
      frame += 1;
      const next = Math.round(start + (diff * frame) / steps);
      setDisplay(frame >= steps ? target : next);
      if (frame < steps) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, loading]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - ((ready ? display : 0) / 100) * circumference;

  const tone =
    target >= 85 ? "text-leaf-700" : target >= 70 ? "text-leaf-600" : target >= 55 ? "text-amber-600" : "text-red-600";
  const ring =
    target >= 85 ? "#047857" : target >= 70 ? "#059669" : target >= 55 ? "#d97706" : "#dc2626";
  const glow =
    target >= 70 ? "rgba(5,150,105,0.22)" : target >= 55 ? "rgba(217,119,6,0.2)" : "rgba(220,38,38,0.18)";

  const gradientId = useMemo(() => `comp-ring-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
          boxShadow: `0 0 0 10px ${glow}`,
        }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={ring} />
              <stop offset="100%" stopColor={target >= 55 ? "#34d399" : "#f87171"} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#eef0f4"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={`font-display text-4xl font-semibold tabular-nums tracking-tight ${tone}`}>
            {loading ? "…" : `${display}%`}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">Complete</p>
        </div>
      </div>
      {label ? (
        <p className={`mt-4 rounded-full bg-white/80 px-3 py-1 text-sm font-semibold shadow-soft ${tone}`}>
          {label}
        </p>
      ) : null}
    </div>
  );
}
