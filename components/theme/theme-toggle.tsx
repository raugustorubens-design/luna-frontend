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
      /*
       * GENESIS/pacotes/2026-08-20-hero-desktop-e-acesso.md, item 2 —
       * `1.125rem` é `text-xs` (0.75rem, padrão do Tailwind — sem override
       * de fontSize em `tailwind.config.ts`) × 1.5, não o token
       * `--luna-step--1` (0.8125rem, usado nos links da nav em
       * `app/(site)/v2/page.tsx`). Os dois valores não são equivalentes:
       * amarrar este botão ao token teria trocado a base de 0.75rem para
       * 0.8125rem antes de multiplicar — mudança de tipografia fora do que
       * o item 2 pediu. Valor fixo aqui é intencional, não descuido.
       */
      className={`inline-flex shrink-0 items-center gap-2 rounded-[var(--luna-radius)] border border-[var(--luna-line-2)] px-3 py-1.5 text-[1.125rem] text-[var(--luna-text-2)] transition-colors hover:border-[var(--luna-line-3)] hover:text-[var(--luna-text)] ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5"
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
