"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { LanguageProvider, useI18n } from "@/lib/i18n/context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { api, clearToken, getToken } from "@/lib/api";
import {
  BarChart3,
  Bot,
  Building2,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";

const nav: { href: string; labelKey: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { href: "/overview", labelKey: "nav.overview", icon: LayoutDashboard },
  { href: "/businesses", labelKey: "nav.businesses", icon: Building2 },
  { href: "/optimizer", labelKey: "nav.optimizer", icon: Sparkles },
  { href: "/reviews", labelKey: "nav.reviews", icon: MessageSquare },
  { href: "/posts", labelKey: "nav.posts", icon: ImageIcon },
  { href: "/audit", labelKey: "nav.audit", icon: Search },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
  { href: "/assistant", labelKey: "nav.assistant", icon: Bot },
  { href: "/automation", labelKey: "nav.automation", icon: Workflow },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

type Me = {
  user: { full_name: string; email: string };
  tenant: { name: string; role: string } | null;
  google_connected: boolean;
};

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale, locales } = useI18n();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<Me>("/auth/me")
      .then(setMe)
      .catch(() => {
        clearToken();
        router.replace("/login");
      });
  }, [router]);

  return (
    <div className="min-h-screen grid grid-cols-[248px_1fr] bg-paper-100">
      <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-paper-300 bg-white">
        <div className="px-5 py-5">
          <BrandMark />
        </div>

        <div className="mx-3 mb-3 rounded-2xl border border-leaf-100 bg-leaf-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf-700">
            {t("nav.language")} / भाषा / भाषा
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {locales.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLocale(item.code)}
                className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                  locale === item.code
                    ? "bg-ink-900 text-white"
                    : "border border-paper-300 bg-white text-ink-700 hover:bg-paper-100"
                }`}
              >
                {item.code === "en" ? "EN" : item.code === "hi" ? "हि" : "मर"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            {locales.find((l) => l.code === locale)?.native}
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3 pb-4">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-leaf-50 text-leaf-700" : "text-ink-500 hover:bg-paper-100 hover:text-ink-900"
                }`}
              >
                <Icon size={16} />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 mb-5 rounded-2xl border border-paper-300 bg-paper-50 p-4">
          <p className="text-sm font-semibold text-ink-900">{me?.tenant?.name || "Workspace"}</p>
          <p className="mt-1 text-xs text-ink-400">{me?.user.email}</p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf-600">
            {me?.google_connected ? t("nav.connected") : t("nav.demo")}
          </p>
          <button
            onClick={() => {
              clearToken();
              router.push("/login");
            }}
            className="mt-4 flex items-center gap-2 text-xs font-medium text-ink-400 hover:text-ink-900"
          >
            <LogOut size={14} /> {t("nav.signOut")}
          </button>
        </div>
      </aside>
      <div className="min-h-screen bg-paper-100">{children}</div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AppShell>{children}</AppShell>
    </LanguageProvider>
  );
}
