"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { RONDA_THEME_STORAGE_KEY, type RondaTheme } from "@/lib/ronda/theme";

const RondaThemeContext = createContext<{ theme: RondaTheme; toggleTheme: () => void } | null>(null);

export function useRondaTheme() {
  const ctx = useContext(RondaThemeContext);
  if (!ctx) throw new Error("useRondaTheme precisa estar dentro de RondaThemeProvider");
  return ctx;
}

/**
 * Escuro é o padrão (classe `dark` presente no elemento raiz por padrão,
 * tanto na renderização do servidor quanto antes de qualquer JS rodar).
 * O script inline abaixo roda de forma síncrona, antes da primeira
 * pintura, e remove a classe `dark` se a pessoa já tinha escolhido claro
 * numa visita anterior — evita o "flash" do tema errado. Escopo: só o
 * elemento com `id="ronda-theme-root"` (e seus descendentes via seletor
 * `.dark` do Tailwind) — não mexe em `<html>` nem em nenhuma classe
 * usada fora de /ronda, então o Forge não é afetado.
 *
 * A classe `dark` precisa estar num elemento ANCESTOR do elemento que usa
 * `dark:...` — o seletor gerado pelo Tailwind é `.dark :is(...)`, que não
 * bate quando as duas classes estão no mesmo elemento. Por isso o toggle
 * (`id="ronda-theme-root"`) e as classes visuais (`bg-[...] dark:bg-[...]`)
 * vivem em dois elementos separados, pai e filho, não no mesmo `<div>`.
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=window.localStorage.getItem(${JSON.stringify(
  RONDA_THEME_STORAGE_KEY,
)});var el=document.getElementById("ronda-theme-root");if(el&&t==="light"){el.classList.remove("dark")}}catch(e){}})();`;

export function RondaThemeProvider({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  // "dark" aqui só reflete o padrão de renderização do servidor — o efeito
  // abaixo lê a classe real aplicada no DOM (já corrigida pelo script
  // inline, se havia preferência salva) assim que monta, pra não divergir.
  const [theme, setTheme] = useState<RondaTheme>("dark");

  useEffect(() => {
    const applied: RondaTheme = rootRef.current?.classList.contains("dark") ? "dark" : "light";
    setTheme(applied);
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next: RondaTheme = current === "dark" ? "light" : "dark";
      rootRef.current?.classList.toggle("dark", next === "dark");
      try {
        window.localStorage.setItem(RONDA_THEME_STORAGE_KEY, next);
      } catch {
        // localStorage indisponível (modo privado, cota, etc.) — a troca de
        // tema em si continua funcionando, só não persiste entre visitas.
      }
      return next;
    });
  }

  return (
    <RondaThemeContext.Provider value={{ theme, toggleTheme }}>
      <div id="ronda-theme-root" ref={rootRef} className="dark">
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/*
          Pacote "Safety Walk para o Padrão de Cores"
          (GENESIS/pacotes/2026-08-19-safety-walk-cores.md, Luna-context.md,
          ADR-024), Etapa 1, 19/08/2026 — inversão de hierarquia de
          superfície, mesma migração já feita em `/v2` (ADR-024 emenda o
          ADR-022): a página passa a partir de `#000206` (quase preto,
          "vazio" do Padrão SMX de Cores), e o Midnight deixa de cobrir a
          tela inteira — vira a cor que emerge dela, no topo do degradê.

          Fundo escuro em degradê vertical, Midnight (#1E2761) no topo até
          quase preto (#000206) embaixo. Mesmas três decisões de antes,
          valores invertidos:

          - **Vertical, escuro no topo:** o cabeçalho (título, alternador de
            tema, botão de voltar) e os selos de estado vivem no topo — a
            faixa mais escura fica exatamente onde a densidade de texto é
            maior. No iOS a barra de status é `black-translucent` (ver
            `app/ronda/layout.tsx`): `#000206` no topo é o que deixa os
            ícones do sistema legíveis, melhor do que o `#05060B` de antes
            (mais próximo do preto que a barra de status realmente compõe).
          - **`#000206`, não `#000000`:** mantém o mesmo viés azul de
            `#1E2761`, então a interpolação fica dentro de uma família de
            matiz só — um quase preto neutro passaria por um meio-tom
            acinzentado no caminho até o Midnight.
          - **Sem `bg-fixed`:** as três telas de /ronda (`ronda-wizard`,
            `ronda-editor`, `ronda-list`) são `min-h-dvh` com o scroll
            interno no `<main>`, não no documento — este elemento tem
            sempre a altura da viewport, então o degradê já se repete
            igual em toda tela sem depender de `background-attachment`
            (que é justamente o que costuma falhar no Safari do iOS, o
            alvo principal deste PWA).

          `dark:bg-[#000206]` continua abaixo do degradê como cor sólida de
          fallback (`background-color` e `background-image` são propriedades
          distintas, as duas se aplicam) — se o degradê não pintar, o fundo
          cai no quase preto, nunca no fundo claro.

          Texto escuro `#DCE6F2` (era `#F4F6FB`): sobre um fundo quase
          preto, branco quase puro cintila — mesma correção já feita em
          `/v2`. Tema claro não muda nesta etapa: fundo `#F4F6FB` e texto
          `#0A1B3D` (era `#1E2761` — o Midnight em si nunca foi pensado
          como cor de texto corrido; `#0A1B3D` é o valor que o Padrão SMX
          de Cores define para isso, 15,7:1 de contraste sobre o papel).
        */}
        <div
          id="ronda-root"
          className="min-h-dvh bg-[#F4F6FB] text-[#0A1B3D] [color-scheme:light] dark:bg-[#000206] dark:bg-[linear-gradient(180deg,#1E2761_0%,#000206_100%)] dark:text-[#DCE6F2] dark:[color-scheme:dark]"
        >
          {children}
        </div>
      </div>
    </RondaThemeContext.Provider>
  );
}

