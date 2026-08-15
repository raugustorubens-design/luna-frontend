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
          Fundo escuro em degradê vertical, quase preto (#05060B) no topo até
          o Midnight (#1E2761) embaixo. Três decisões por trás disto:

          - **Vertical, escuro no topo:** o cabeçalho (título, alternador de
            tema, botão de voltar) e os selos de estado vivem no topo — a
            faixa mais escura fica exatamente onde a densidade de texto é
            maior. No iOS a barra de status é `black-translucent` (ver
            `app/ronda/layout.tsx`), ou seja, ela se sobrepõe ao topo da
            página: quase preto ali é o que deixa os ícones do sistema
            legíveis.
          - **`#05060B`, não `#000000`:** mantém o mesmo viés azul de
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

          `dark:bg-[#1E2761]` continua abaixo do degradê como cor sólida de
          fallback (`background-color` e `background-image` são propriedades
          distintas, as duas se aplicam) — se o degradê não pintar, o fundo
          cai no Midnight de antes, nunca no fundo claro.
        */}
        <div
          id="ronda-root"
          className="min-h-dvh bg-[#F4F6FB] text-[#1E2761] [color-scheme:light] dark:bg-[#1E2761] dark:bg-[linear-gradient(180deg,#05060B_0%,#1E2761_100%)] dark:text-[#F4F6FB] dark:[color-scheme:dark]"
        >
          {children}
        </div>
      </div>
    </RondaThemeContext.Provider>
  );
}

