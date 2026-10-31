"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
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

const nav = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/businesses", label: "My Businesses", icon: Building2 },
  { href: "/optimizer", label: "AI Profile Optimizer", icon: Sparkles },
  { href: "/reviews", label: "Reviews", icon: MessageSquare },
  { href: "/posts", label: "Posts & Photos", icon: ImageIcon },
  { href: "/audit", label: "SEO & Profile Audit", icon: Search },
  { href: "/analytics", label: "Analytics & Reports", icon: BarChart3 },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/automation", label: "Automation Settings", icon: Workflow },
  { href: "/settings", label: "Account Settings", icon: Settings },
];

type Me = {
  user: { full_name: string; email: string };
  tenant: { name: string; role: string } | null;
  google_connected: boolean;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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
      <aside className="sticky top-0 h-screen overflow-y-auto border-r border-paper-300 bg-white">
        <div className="px-5 py-5">
          <BrandMark />
        </div>
        <nav className="space-y-1 px-3 pb-6">
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
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mx-3 mb-5 rounded-2xl border border-paper-300 bg-paper-50 p-4">
          <p className="text-sm font-semibold text-ink-900">{me?.tenant?.name || "Workspace"}</p>
          <p className="mt-1 text-xs text-ink-400">{me?.user.email}</p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf-600">
            {me?.google_connected ? "Profile connected" : "Demo / pending"}
          </p>
          <button
            onClick={() => {
              clearToken();
              router.push("/login");
            }}
            className="mt-4 flex items-center gap-2 text-xs font-medium text-ink-400 hover:text-ink-900"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <div className="min-h-screen bg-paper-100">{children}</div>
    </div>
  );
}
