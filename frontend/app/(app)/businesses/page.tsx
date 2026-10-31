"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { api } from "@/lib/api";

type Location = {
  id: string;
  title: string;
  address?: string;
  phone?: string;
  website?: string;
  primary_category?: string;
  is_selected: boolean;
  sync_status: string;
};

export default function BusinessesPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLocations(await api<Location[]>("/google/locations"));
  }

  useEffect(() => {
    load().catch(() => setLocations([]));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/profile/businesses", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          address: form.get("address"),
          phone: form.get("phone"),
          website: form.get("website"),
          primary_category: form.get("primary_category"),
          description: form.get("description"),
        }),
      });
      setOpen(false);
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add business");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      kicker="My businesses"
      title="Authorized locations"
      description="Manage connected locations. Add a new business manually now — link it to Google after GBP API approval."
      action={
        <button
          onClick={() => setOpen((value) => !value)}
          className="rounded-full bg-leaf-500 px-4 py-2 text-sm font-semibold text-white"
        >
          {open ? "Close form" : "Add new business"}
        </button>
      }
    >
      {open && (
        <form onSubmit={onSubmit} className="surface mb-6 grid gap-3 rounded-[28px] p-6 md:grid-cols-2">
          <input name="title" required placeholder="Business name" className="rounded-2xl border border-paper-300 px-4 py-3" />
          <input name="primary_category" defaultValue="Chinese restaurant" className="rounded-2xl border border-paper-300 px-4 py-3" />
          <input name="phone" placeholder="Phone" className="rounded-2xl border border-paper-300 px-4 py-3" />
          <input name="website" placeholder="Website URL" className="rounded-2xl border border-paper-300 px-4 py-3" />
          <input name="address" placeholder="Full address" className="md:col-span-2 rounded-2xl border border-paper-300 px-4 py-3" />
          <textarea name="description" rows={3} placeholder="Short description" className="md:col-span-2 rounded-2xl border border-paper-300 px-4 py-3" />
          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
          <button disabled={saving} className="w-fit rounded-full bg-ink-900 px-5 py-2.5 font-semibold text-white">
            {saving ? "Saving…" : "Save business"}
          </button>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {locations.map((location) => (
          <article key={location.id} className="surface rounded-[28px] p-6">
            <p className="text-lg font-semibold">{location.title}</p>
            <p className="mt-1 text-sm text-ink-500">{location.primary_category}</p>
            <p className="mt-3 text-sm text-ink-500">{location.address}</p>
            <p className="mt-2 text-sm text-ink-400">{location.phone}</p>
            {location.website && <p className="mt-1 text-sm text-leaf-600">{location.website}</p>}
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-leaf-600">
              {location.is_selected ? "Active" : "Hidden"} · {location.sync_status}
            </p>
          </article>
        ))}
        {!locations.length && (
          <article className="surface rounded-[28px] p-6 text-ink-500">No locations yet. Add a new business to start.</article>
        )}
      </div>
    </PageShell>
  );
}
