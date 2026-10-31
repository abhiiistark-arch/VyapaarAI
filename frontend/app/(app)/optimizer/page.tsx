"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AiFeedback } from "@/components/AiFeedback";
import { api } from "@/lib/api";
import { FileText, Globe, ListChecks, Megaphone, Sparkles, Tags } from "lucide-react";

type Profile = {
  id: string;
  title: string;
  website?: string;
  description?: string;
  phone?: string;
  address?: string;
  primary_category?: string;
  hours?: string;
  services?: string[];
  attributes?: string[];
  sync_status?: string;
  is_selected?: boolean;
};

type OptimizeResult = {
  title?: string;
  suggestion?: string;
  improved_text?: string;
  checklist?: string[];
  ready_to_apply?: boolean;
  _model_used?: string;
  source?: string;
  gemini_error?: string;
};

const shortcuts = [
  { focus: "description", label: "Improve description", icon: FileText, notes: "Local SEO from current business profile" },
  { focus: "website", label: "Website / links", icon: Globe, notes: "Improve website / Maps CTA from current link" },
  { focus: "services", label: "Services list", icon: ListChecks, notes: "Use menu services already on this profile" },
  { focus: "categories", label: "Categories", icon: Tags, notes: "Primary + additional categories" },
  { focus: "posts", label: "Post ideas", icon: Megaphone, notes: "Post ideas from this location’s menu & hours" },
  { focus: "attributes", label: "Attributes", icon: Sparkles, notes: "Takeaway, dine-in, family portions, etc." },
];

export default function OptimizerPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [focus, setFocus] = useState("description");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [hours, setHours] = useState("");
  const [servicesText, setServicesText] = useState("");
  const [attributesText, setAttributesText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [lastNotes, setLastNotes] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  function applyProfileToForm(row: Profile) {
    setProfile(row);
    setWebsite(row.website || "");
    setDescription(row.description || "");
    setPhone(row.phone || "");
    setCategory(row.primary_category || "");
    setHours(row.hours || "");
    setServicesText((row.services || []).join(", "));
    setAttributesText((row.attributes || []).join(", "));
  }

  async function loadProfiles(preferredId?: string) {
    const rows = await api<Profile[]>("/google/locations");
    setProfiles(rows);
    const selected = rows.find((row) => row.id === preferredId) || rows.find((row) => row.is_selected) || rows[0];
    if (selected) applyProfileToForm(selected);
    return selected;
  }

  useEffect(() => {
    loadProfiles().catch((err) => setError(err.message || "Could not load My Businesses profile"));
  }, []);

  async function runOptimize(nextFocus: string, notes: string) {
    if (!profile?.id) {
      setError("No business loaded. Login as owner@rajveerchinese.demo or add a business in My Businesses.");
      return;
    }
    setFocus(nextFocus);
    setLastNotes(notes);
    setLoading(true);
    setError("");
    setSaveNote("");
    setShowFeedback(false);
    try {
      const data = await api<OptimizeResult & { profile?: Profile }>("/profile/optimize", {
        method: "POST",
        body: JSON.stringify({ location_id: profile.id, focus: nextFocus, notes }),
      });
      setResult(data);
      setShowFeedback(true);
      if (data.profile) applyProfileToForm(data.profile);
      if (data.improved_text) {
        if (nextFocus === "website") setWebsite(data.improved_text);
        else if (nextFocus === "services") setServicesText(data.improved_text);
        else if (nextFocus === "attributes") setAttributesText(data.improved_text);
        else if (nextFocus === "categories") setCategory(data.improved_text.split(";")[0].trim());
        else setDescription(data.improved_text);
      }
      if (data.gemini_error) {
        setSaveNote(`Gemini busy/unavailable (${data._model_used}). Showing profile-linked draft instead.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimize failed");
    } finally {
      setLoading(false);
    }
  }

  async function applyChanges(event?: FormEvent) {
    event?.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
    setError("");
    try {
      const data = await api<{ note: string; profile?: Profile }>("/profile/apply", {
        method: "POST",
        body: JSON.stringify({
          location_id: profile.id,
          description,
          website,
          phone,
          primary_category: category,
          hours,
          services_text: servicesText,
          attributes_text: attributesText,
        }),
      });
      setSaveNote(data.note);
      if (data.profile) applyProfileToForm(data.profile);
      await loadProfiles(profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      kicker="AI profile optimizer"
      title="Enhance your My Businesses profile"
      description="This page is linked to the same business data as My Businesses. AI drafts edit that profile — later the same save path syncs to Google."
    >
      {!profiles.length && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No business found in this workspace. Use demo login <b>owner@rajveerchinese.demo</b> / <b>vyapaarai123</b>,
          or add a business in My Businesses.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={profile?.id || ""}
          onChange={(e) => {
            const row = profiles.find((item) => item.id === e.target.value);
            if (row) applyProfileToForm(row);
          }}
          className="rounded-2xl border border-paper-300 bg-white px-4 py-3"
        >
          {profiles.map((row) => (
            <option key={row.id} value={row.id}>
              {row.title}
            </option>
          ))}
        </select>
      </div>

      {profile && (
        <article className="surface mb-6 rounded-[28px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf-600">Current My Businesses profile</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">{profile.title}</h2>
              <p className="mt-1 text-sm text-ink-500">{profile.primary_category}</p>
            </div>
            <span className="rounded-full bg-paper-100 px-3 py-1 text-xs font-semibold text-leaf-700">
              {profile.sync_status || "demo"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-ink-600">
            <p><span className="font-semibold text-ink-900">Address:</span> {profile.address || "—"}</p>
            <p><span className="font-semibold text-ink-900">Phone:</span> {profile.phone || "—"}</p>
            <p><span className="font-semibold text-ink-900">Website:</span> {profile.website || "—"}</p>
            <p><span className="font-semibold text-ink-900">Hours:</span> {profile.hours || "—"}</p>
            <p className="md:col-span-2"><span className="font-semibold text-ink-900">Services:</span> {(profile.services || []).join(", ") || "—"}</p>
            <p className="md:col-span-2"><span className="font-semibold text-ink-900">Attributes:</span> {(profile.attributes || []).join(", ") || "—"}</p>
            <p className="md:col-span-2"><span className="font-semibold text-ink-900">Description:</span> {profile.description || "—"}</p>
          </div>
        </article>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.focus}
              onClick={() => runOptimize(item.focus, item.notes)}
              disabled={loading || !profile?.id}
              className={`surface flex items-start gap-3 rounded-[24px] p-5 text-left transition hover:border-leaf-500 ${
                focus === item.focus ? "ring-2 ring-leaf-500" : ""
              }`}
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-leaf-50 text-leaf-600">
                <Icon size={18} />
              </span>
              <span>
                <span className="block font-semibold text-ink-900">{item.label}</span>
                <span className="mt-1 block text-sm text-ink-500">{item.notes}</span>
              </span>
            </button>
          );
        })}
      </div>

      {loading && <p className="mt-4 text-sm text-ink-500">Working on your profile draft…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {saveNote && <p className="mt-4 rounded-2xl bg-leaf-50 px-4 py-3 text-sm text-leaf-700">{saveNote}</p>}

      {(result || profile) && (
        <article className="surface mt-6 rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf-600">
            {result?.title || "Editable profile fields"}
            {result?._model_used ? ` · ${result._model_used}` : ""}
          </p>
          {result?.suggestion && <p className="mt-2 text-sm text-ink-500">{result.suggestion}</p>}
          <form onSubmit={applyChanges} className="mt-5 grid gap-4">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              Description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal" />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
                Website
                <input value={website} onChange={(e) => setWebsite(e.target.value)} className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
                Category
                <input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
                Hours
                <input value={hours} onChange={(e) => setHours(e.target.value)} className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal" />
              </label>
            </div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              Services (comma separated)
              <textarea value={servicesText} onChange={(e) => setServicesText(e.target.value)} rows={2} className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              Attributes (comma separated)
              <textarea value={attributesText} onChange={(e) => setAttributesText(e.target.value)} rows={2} className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal" />
            </label>
            {result?.checklist && (
              <ul className="space-y-2">
                {result.checklist.map((item) => (
                  <li key={item} className="rounded-2xl bg-paper-100 px-4 py-2 text-sm text-ink-600">
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {showFeedback && result && (
              <AiFeedback
                busy={loading}
                onApprove={() => setSaveNote("Draft approved. Edit fields above if needed, then Apply.")}
                onImprove={(improveNotes) =>
                  runOptimize(focus, `${lastNotes}\nUser requested improvements: ${improveNotes}`)
                }
              />
            )}
            <button disabled={saving || !profile?.id} className="w-fit rounded-full bg-leaf-500 px-5 py-2.5 font-semibold text-white">
              {saving ? "Saving…" : "Apply to My Businesses profile"}
            </button>
          </form>
        </article>
      )}
    </PageShell>
  );
}
