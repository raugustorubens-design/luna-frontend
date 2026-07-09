import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens estruturais do Forge (Dev Mode) — ver app/globals.css. Não conflitam
        // com o namespace `luna.*` abaixo, usado pelo User Mode.
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        aura: "0 0 80px rgba(124,58,237,0.35)",
        cyan: "0 0 45px rgba(34,211,238,0.35)"
      }
    }
  },
  plugins: []
} satisfies Config;
