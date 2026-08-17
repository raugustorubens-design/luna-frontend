"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { SITE_THEME_ATTRIBUTE, SITE_THEME_STORAGE_KEY, type SiteTheme } from "@/lib/site/theme";

const SiteThemeContext = createContext<{ theme: SiteTheme; toggleTheme: () => void } | null>(null);

export function useSiteTheme() {
  const ctx = useContext(SiteThemeContext);
  if (!ctx) throw new Error("useSiteTheme precisa estar dentro de SiteThemeProvider");
  return ctx;
}

/**
 * Script síncrono, antes da primeira pintura. Sem ele, quem escolheu claro
 * numa visita anterior vê um quadro escuro antes de o React hidratar — o
 * mesmo "flash" que o provider de `/ronda` já resolve do mesmo jeito.
 *
 * Escreve o atributo só no elemento deste provider (`#luna-site-theme-root`),
 * nunca em `<html>`: `/ronda` e a `/` atual dividem o mesmo documento e não
 * podem ser alcançadas por ele.
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=window.localStorage.getItem(${JSON.stringify(
  SITE_THEME_STORAGE_KEY,
)});var el=document.getElementById("luna-site-theme-root");if(el&&t==="light"){el.setAttribute(${JSON.stringify(
  SITE_THEME_ATTRIBUTE,
)},"light")}}catch(e){}})();`;

/**
 * ADR-022 — provider IRMÃO do de `/ronda`, não uma extensão dele.
 *
 * `components/ronda/theme-provider.tsx` não foi tocado e continua sendo o
 * único responsável por `/ronda`: classe `dark` em `#ronda-theme-root`, chave
 * `luna-ronda-theme`. Este aqui cobre `/v2` e `/forge?layout=v2`: atributo
 * `data-theme` em `#luna-site-theme-root`, chave `luna-site-theme`.
 *
 * São dois mecanismos diferentes de propósito (classe vs. atributo), então
 * um não pode ativar o outro nem por acidente de seletor. O preço é duas
 * chaves de preferência coexistindo — dívida registrada no ADR-022.
 *
 * Escuro é o padrão, como no produto: a ausência do atributo já é o tema
 * escuro (ver `:root` em `app/globals.css`), o que também torna a renderização
 * do servidor correta sem depender de JS.
 */
export function SiteThemeProvider({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  // "dark" aqui é só o padrão da renderização do servidor. O efeito abaixo lê
  // o atributo real já aplicado no DOM (corrigido pelo script inline, se havia
  // preferência salva) assim que monta, pra o botão não divergir da tela.
  const [theme, setTheme] = useState<SiteTheme>("dark");

  useEffect(() => {
    const applied: SiteTheme =
      rootRef.current?.getAttribute(SITE_THEME_ATTRIBUTE) === "light" ? "light" : "dark";
    setTheme(applied);
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next: SiteTheme = current === "dark" ? "light" : "dark";
      if (next === "light") {
        rootRef.current?.setAttribute(SITE_THEME_ATTRIBUTE, "light");
      } else {
        // Remover o atributo — e não escrever "dark" — mantém o escuro sendo
        // literalmente o padrão do `:root`, com um caminho só para essa cor.
        rootRef.current?.removeAttribute(SITE_THEME_ATTRIBUTE);
      }
      try {
        window.localStorage.setItem(SITE_THEME_STORAGE_KEY, next);
      } catch {
        // localStorage indisponível (modo privado, cota, etc.) — a troca de
        // tema continua funcionando, só não persiste entre visitas.
      }
      return next;
    });
  }

  return (
    <SiteThemeContext.Provider value={{ theme, toggleTheme }}>
      <div id="luna-site-theme-root" ref={rootRef} className="luna-v2">
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </div>
    </SiteThemeContext.Provider>
  );
}
