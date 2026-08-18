"use client";

import { useSiteTheme } from "./site-theme-provider";

/**
 * Espelha o botão de `/ronda` (`components/ronda/theme-toggle.tsx`): rótulo
 * acessível que diz o destino da ação, não o estado atual, e alternância
 * manual — sem automático por preferência do sistema.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useSiteTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className={`inline-flex shrink-0 items-center gap-2 rounded-[var(--luna-radius)] border border-[var(--luna-line-2)] px-3 py-1.5 text-xs text-[var(--luna-text-2)] transition-colors hover:border-[var(--luna-line-3)] hover:text-[var(--luna-text)] ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        )}
      </svg>
      {isDark ? "Tema claro" : "Tema escuro"}
    </button>
  );
}
