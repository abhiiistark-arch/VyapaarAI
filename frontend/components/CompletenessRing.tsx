"use client";

type Props = {
  percent: number;
  label?: string;
  size?: number;
  stroke?: number;
};

export function CompletenessRing({ percent, label, size = 148, stroke = 12 }: Props) {
  const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const tone =
    value >= 85 ? "text-leaf-600" : value >= 70 ? "text-leaf-500" : value >= 55 ? "text-amber-600" : "text-red-600";
  const ring =
    value >= 85 ? "#059669" : value >= 70 ? "#10b981" : value >= 55 ? "#d97706" : "#dc2626";

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
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
            stroke={ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={`font-display text-3xl font-semibold tabular-nums ${tone}`}>{value}%</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">Complete</p>
        </div>
      </div>
      {label ? <p className={`mt-3 text-sm font-semibold ${tone}`}>{label}</p> : null}
    </div>
  );
}
