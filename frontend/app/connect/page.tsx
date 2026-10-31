"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api, getToken } from "@/lib/api";
import { Check, Shield } from "lucide-react";

type Location = {
  id: string;
  title: string;
  address?: string;
  primary_category?: string;
  is_selected: boolean;
};

function ConnectInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Checking Google connection mode…");
  const [configured, setConfigured] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(params.get("error") || "");
  const [saving, setSaving] = useState(false);
  const [permissionsUrl, setPermissionsUrl] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const justConnected = params.get("connected") === "1";
    if (justConnected) {
      setConnected(true);
      api<Location[]>("/google/locations")
        .then(setLocations)
        .catch((err) => setError(err.message));
      return;
    }
    Promise.all([
      api<{ permissions_url: string; configured: boolean; message: string }>("/google/connect"),
      api<Location[]>("/google/locations"),
    ])
      .then(([connect, locs]) => {
        setConfigured(connect.configured);
        setMessage(connect.message);
        setPermissionsUrl(connect.permissions_url);
        setLocations(locs);
        if (locs.length) setConnected(true);
        if (connect.configured && connect.permissions_url && !params.get("error")) {
          window.location.href = connect.permissions_url;
        }
      })
      .catch((err) => setError(err.message));
  }, [params, router]);

  async function saveSelection() {
    setSaving(true);
    try {
      await api("/google/locations/select", {
        method: "POST",
        body: JSON.stringify({
          location_ids: locations.filter((row) => row.is_selected).map((row) => row.id),
        }),
      });
      router.push("/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save locations");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <BrandMark />
      <div className="surface mt-10 rounded-[28px] p-8">
        <div className="flex items-center gap-3 text-leaf-600">
          <Shield size={18} />
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Google connection</p>
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold">Connect Business Profile</h1>
        <p className="mt-3 text-ink-500">
          Live Google permissions open directly when <code className="text-ink-700">USE_LIVE_GOOGLE=true</code>.
          Until then, demo locations stay available so you can test the full product.
        </p>
        <p className="mt-6 text-sm text-ink-500">{message}</p>
        {!configured && (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
            Demo mode is active. Flip env flags after Google GBP approval — no code rewrite needed.
          </p>
        )}
        {configured && permissionsUrl && !connected && (
          <a href={permissionsUrl} className="mt-6 inline-flex rounded-full bg-leaf-500 px-5 py-3 font-semibold text-white">
            Open Google permissions
          </a>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {(connected || locations.length > 0) && (
          <div className="mt-8">
            <p className="text-sm font-medium text-leaf-700">Locations ready for this workspace</p>
            <div className="mt-4 space-y-3">
              {locations.map((location) => (
                <label key={location.id} className="flex cursor-pointer items-start gap-4 rounded-2xl border border-paper-300 bg-paper-50 p-4">
                  <input
                    type="checkbox"
                    checked={location.is_selected}
                    onChange={() =>
                      setLocations((rows) =>
                        rows.map((row) => (row.id === location.id ? { ...row, is_selected: !row.is_selected } : row))
                      )
                    }
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium">{location.title}</p>
                    <p className="text-sm text-ink-400">{location.primary_category || "Uncategorized"}</p>
                    <p className="text-sm text-ink-400">{location.address}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={saveSelection}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-leaf-500 px-5 py-3 font-semibold text-white"
              >
                <Check size={16} /> {saving ? "Saving…" : "Save & open dashboard"}
              </button>
              <Link href="/overview" className="rounded-full border border-paper-300 px-5 py-3 text-sm font-semibold text-ink-700">
                Skip for now
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<main className="p-10 text-ink-500">Loading connection…</main>}>
      <ConnectInner />
    </Suspense>
  );
}
