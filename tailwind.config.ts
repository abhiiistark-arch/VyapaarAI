import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          50: "#ffffff",
          100: "#f6f7f9",
          200: "#eef0f4",
          300: "#e3e6ec",
        },
        ink: {
          900: "#101828",
          700: "#344054",
          500: "#667085",
          400: "#98a2b3",
        },
        leaf: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#059669",
          600: "#047857",
          700: "#065f46",
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(16, 24, 40, 0.06)",
        lift: "0 18px 40px rgba(16, 24, 40, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
