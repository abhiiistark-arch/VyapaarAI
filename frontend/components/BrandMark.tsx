export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-leaf-500 text-white shadow-soft">
        <span className="font-display text-sm font-semibold tracking-tight">VA</span>
      </div>
      {!compact && (
        <div>
          <p className="font-display text-sm font-semibold tracking-tight text-ink-900">VyapaarAI</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Business Profile OS</p>
        </div>
      )}
    </div>
  );
}
