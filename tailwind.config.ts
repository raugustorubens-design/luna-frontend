import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        luna: {
          bg: "#050816",
          secondary: "#0B1020",
          panel: "#111827",
          border: "#1F2937",
          violet: "#7C3AED",
          violetMid: "#8B5CF6",
          violetGlow: "#A78BFA",
          cyan: "#06B6D4",
          cyanHi: "#22D3EE",
          success: "#10B981",
          warn: "#F59E0B",
          danger: "#EF4444",
          text: "#F9FAFB",
          textSub: "#CBD5E1",
          textMuted: "#64748B"
        }
      },
      boxShadow: {
        aura: "0 0 80px rgba(124,58,237,0.35)",
        cyan: "0 0 45px rgba(34,211,238,0.35)"
      }
    }
  },
  plugins: []
} satisfies Config;
