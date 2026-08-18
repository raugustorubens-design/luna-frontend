"use client";

import { useEffect, useRef } from "react";

/**
 * Revelação por rolagem, uma vez só, sem biblioteca.
 *
 * A classe `luna-reveal-armed` é posta pelo próprio efeito, e é ela que
 * habilita o estado inicial invisível em `app/globals.css`. Com JS desligado
 * ou antes da hidratação, a classe não existe e a página aparece inteira —
 * conteúdo nunca depende de animação pra ser lido.
 *
 * O razão de estado (`.luna-ledger`) tem um gesto próprio: as barras de
 * classificação crescem de cima pra baixo quando a tabela entra na tela, o
 * mesmo movimento da faixa lateral do cartão de achado da ronda.
 */
export function Reveal({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.classList.add("luna-reveal-armed");

    const targets = root.querySelectorAll<HTMLElement>(".luna-reveal, .luna-ledger");

    // Sem IntersectionObserver (navegador antigo) tudo entra visível de uma
    // vez — degradação, não tela em branco.
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-in", "is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in", "is-revealed");
          // Uma vez revelado, para de observar: a animação é de entrada, não
          // um efeito que se repete a cada rolagem pra cima e pra baixo.
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
