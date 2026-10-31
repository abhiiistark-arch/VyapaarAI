/** App config — mirrors backend/app/core/config.py (env-driven). */
export const config = {
  appName: process.env.APP_NAME || "VyapaarAI",
  demoMode: (process.env.DEMO_MODE ?? "true").toLowerCase() !== "false",
  useLiveGoogle: (process.env.USE_LIVE_GOOGLE ?? "false").toLowerCase() === "true",
  secretKey: process.env.SECRET_KEY || "vyapaarai-demo-secret-change-me",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  geminiFastModel: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite",
  frontendUrl:
    process.env.FRONTEND_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
};

export const DEMO_EMAIL = "owner@rajveerchinese.demo";
export const DEMO_PASSWORD = "vyapaarai123";
