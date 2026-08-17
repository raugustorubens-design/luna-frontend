import type { Config } from "tailwindcss";

export default {
  // "class" (não a media query prefers-color-scheme): a alternância do
  // wizard de ronda (/ronda) é manual, via botão — não automática pela
  // preferência do sistema. Nenhum outro lugar do repositório usava
  // dark: antes disto (Forge/User Mode usam variáveis CSS via :root, não
  // esse mecanismo), então ligar isto aqui não muda nada fora de /ronda.
  darkMode: "class",
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
          // ADR-022, 17/08/2026 — único ponto do arquivo em que uma chave
          // existente foi *reatribuída* em vez de acrescentada: `warn` é o
          // nome que o pacote dá ao âmbar de classificação, e TypeScript não
          // aceita a mesma chave duas vezes num literal de objeto. O valor
          // anterior fica na linha abaixo, comentado, para reverter em um
          // comando. Verificado antes de trocar: nenhum componente usa
          // `bg-luna-warn`/`text-luna-warn`/`border-luna-warn` — `luna.success`
          // e `luna.danger` seguem intocados, e `#F59E0B` não aparece em
          // nenhuma outra parte do repositório.
          warn: "#E8A33D",
          // warn: "#F59E0B",  ← valor anterior (âmbar do Tailwind)
          danger: "#EF4444",
          text: "#F9FAFB",
          textSub: "#CBD5E1",
          textMuted: "#64748B",

          // ADR-022 (17/08/2026) — paleta do Safety Walk promovida a paleta do
          // produto. Chaves NOVAS: nenhuma chave acima foi removida, e a única
          // reatribuída (`warn`) está anotada no lugar dela. `luna.violet`,
          // `luna.cyan` e as demais continuam declaradas porque `/` e os
          // componentes atuais ainda as usam — e uma chave a mais não custa
          // nada.
          //
          // Estes hex não são escolha de design: são os valores já em produção
          // em `components/ronda/theme-provider.tsx` (fundo, degradê, texto) e
          // `components/ronda/finding-card.tsx` (as três classificações).
          midnight: "#1E2761",
          paper: "#F4F6FB",
          inkTop: "#05060B",
          ok: "#2E7D32",
          fail: "#C62828",
          onOk: "#FFFFFF",
          // Midnight, não branco: branco sobre #E8A33D mede 2,16:1 e reprova
          // AA. Ver a medição registrada em `finding-card.tsx`.
          onWarn: "#1E2761",
          onFail: "#FFFFFF"
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
