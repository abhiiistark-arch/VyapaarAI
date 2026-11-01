import fs from "fs";
import path from "path";

/** Load missing keys from backend/.env during local Next dev (not used on Vercel). */
function hydrateFromBackendEnv() {
  if (process.env.VERCEL || process.env.GEMINI_API_KEY) return;
  try {
    const candidates = [
      path.join(process.cwd(), "..", "backend", ".env"),
      path.join(process.cwd(), "backend", ".env"),
    ];
    const envPath = candidates.find((p) => fs.existsSync(p));
    if (!envPath) return;
    const text = fs.readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

hydrateFromBackendEnv();

/** App config — mirrors backend/app/core/config.py (env-driven). */
export const config = {
  appName: process.env.APP_NAME || "Digital Dukan",
  demoMode: (process.env.DEMO_MODE ?? "true").toLowerCase() !== "false",
  useLiveGoogle: (process.env.USE_LIVE_GOOGLE ?? "false").toLowerCase() === "true",
  secretKey: process.env.SECRET_KEY || "digital-dukan-demo-secret-change-me",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  geminiFastModel: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite",
  frontendUrl:
    process.env.FRONTEND_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
};

export const DEMO_EMAIL = "owner@rajveerchinese.demo";
export const DEMO_PASSWORD = "vyapaarai123";
