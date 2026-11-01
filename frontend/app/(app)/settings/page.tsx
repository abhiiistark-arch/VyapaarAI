import { PageShell } from "@/components/PageShell";

export default function SettingsPage() {
  return (
    <PageShell
      kicker="Account"
      title="Workspace & Google switch"
      description="Secrets stay in environment variables. Flip live Google when GBP API access is approved."
    >
      <div className="surface rounded-[28px] p-6 space-y-4 text-sm text-ink-600">
        <p>
          <span className="font-semibold text-ink-900">App:</span> Digital Dukan
        </p>
        <p>
          <span className="font-semibold text-ink-900">Demo login:</span> owner@rajveerchinese.demo / vyapaarai123
        </p>
        <p>
          <span className="font-semibold text-ink-900">To go live later:</span> set DEMO_MODE=false, USE_LIVE_GOOGLE=true,
          add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET, restart.
        </p>
      </div>
    </PageShell>
  );
}
