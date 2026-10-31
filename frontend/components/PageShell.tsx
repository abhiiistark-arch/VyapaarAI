export function PageShell({
  kicker,
  title,
  description,
  action,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <main className="px-6 py-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf-600">{kicker}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-8">{children}</div>
    </main>
  );
}

export function EmptyCard({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="surface rounded-3xl p-8">
      <p className="text-lg font-semibold text-ink-900">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">{copy}</p>
    </div>
  );
}
