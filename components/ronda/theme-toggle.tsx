"use client";

import { useRondaTheme } from "./theme-provider";

/** Botão de alternância manual — sem automático por preferência do sistema (decisão do Architect). */
export function ThemeToggle() {
  const { theme, toggleTheme } = useRondaTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="shrink-0 rounded-full border border-black/15 px-3 py-1.5 text-xs text-[#1E2761] transition-colors hover:border-black/30 dark:border-white/15 dark:text-[#F4F6FB] dark:hover:border-white/30"
    >
      {isDark ? "☾ Escuro" : "☀ Claro"}
    </button>
  );
}
