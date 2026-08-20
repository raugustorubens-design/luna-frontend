import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteThemeProvider } from "@/components/theme/site-theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Reveal } from "@/components/site/reveal";
import { Hero, HeroEstado } from "@/components/site/hero";
import { Products } from "@/components/site/products";
import { StateLedger } from "@/components/site/state-ledger";
import { Pipeline } from "@/components/site/pipeline";

export const metadata = {
  title: "LUNA — Sistema cognitivo persistente",
  description:
    "Decisões que não se perdem: geração de documentos de segurança, ronda de inspeção no celular e o ambiente onde a LUNA é construída.",
};

/**
 * ADR-022, etapa 3 — Modo Usuário v2.
 *
 * Página NOVA, em `/v2`. `app/page.tsx` não foi alterado e `/` continua
 * servindo `components/hero.tsx`, `cognitive-dashboard.tsx`,
 * `pipeline-view.tsx`, `chat-terminal.tsx` e `observability-panel.tsx`
 * exatamente como hoje — os dois conjuntos coexistem de propósito.
 *
 * A troca de `/` para este conteúdo é um PR separado, de uma linha, depois de
 * o Arquiteto abrir `/v2` em produção e aprovar. Enquanto isso não acontece, o
 * que já funciona continua sendo o padrão.
 */
export default function SiteV2Page() {
  return (
    <SiteThemeProvider>
      <Reveal>
        <header className="flex items-center gap-6 border-b border-[var(--luna-line)] px-[var(--luna-pad)] py-[1.1rem]">
          <span className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-[family-name:var(--luna-display)] text-sm font-bold tracking-[0.16em]">
              LUNA
            </span>
          </span>

          <nav className="ml-4 hidden gap-6 md:flex">
            {[
              { href: "#produtos", label: "Produtos" },
              { href: "#estado", label: "Estado" },
              { href: "#pipeline", label: "Como funciona" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[length:var(--luna-step--1)] text-[var(--luna-text-2)] transition-colors hover:text-[var(--luna-text)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        <main>
          <Hero />
          <HeroEstado />
          <Products />
          <StateLedger />
          <Pipeline />

          <section className="py-[clamp(4rem,9vw,7rem)]">
            <div className="luna-reveal mx-auto grid w-full max-w-[1240px] items-center gap-8 px-[var(--luna-pad)] lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <h2 className="mb-3.5 text-[length:var(--luna-step-2)]">
                  Construído por uma pessoa só, com regra de obra.
                </h2>
                <p className="max-w-[52ch] text-[length:var(--luna-step--1)] text-[var(--luna-text-2)]">
                  Toda decisão vira documento antes de virar código. Nada é dado como pronto porque
                  o teste passou — só quando foi clicado e visto funcionando. E quem escreve o
                  código não é quem aprova: as duas funções são separadas de propósito, mesmo sendo
                  a mesma pessoa.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/forge"
                    className="inline-flex items-center gap-2 rounded-[var(--luna-radius)] border border-[var(--luna-accent)] bg-[var(--luna-accent)] px-[1.1rem] py-2.5 text-[length:var(--luna-step--1)] font-semibold text-[var(--luna-on-accent)] transition hover:brightness-110"
                  >
                    Entrar no Forge
                    <ArrowRight className="h-[15px] w-[15px]" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="overflow-hidden rounded-[var(--luna-radius)] border border-[var(--luna-line-2)] bg-[var(--luna-surface)] p-2 font-[family-name:var(--luna-mono)] text-[0.6875rem] text-[var(--luna-text-3)]">
                <div className="mb-2 flex gap-1.5 border-b border-[var(--luna-line)] px-2 py-1.5">
                  {[0, 1, 2].map((i) => (
                    <i key={i} className="block h-2 w-2 rounded-full bg-[var(--luna-line-3)]" />
                  ))}
                </div>
                {/* Os mesmos números do razão acima. Se um deles mudar lá, muda
                    aqui — a arte não é decorativa, é a mesma leitura. */}
                <pre className="m-0 whitespace-pre-wrap px-2 pb-3 pt-1 leading-[1.75]">
                  <span className="text-[var(--luna-accent)]">$</span> luna estado --verificar{"\n"}
                  <span className="text-luna-ok">ok  </span> gateway        17 capacidades{"\n"}
                  <span className="text-luna-ok">ok  </span> memoria        pgvector · 36 vetores
                  {"\n"}
                  <span className="text-luna-ok">ok  </span> safety-walk    fila local ativa{"\n"}
                  <span className="text-[var(--luna-accent)]">→</span>     3 pendências abertas{"\n"}
                  {"      "}2 não conformidades
                </pre>
              </div>
            </div>
          </section>
        </main>

        <footer className="px-[var(--luna-pad)] pb-14 pt-10 text-[0.8125rem] text-[var(--luna-text-3)]">
          <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-6">
            <span className="flex items-center gap-2.5">
              <BrandMark />
              <span className="font-[family-name:var(--luna-display)] text-sm font-bold tracking-[0.16em]">
                LUNA
              </span>
            </span>
            <span>Sistema cognitivo persistente</span>
            <span className="font-[family-name:var(--luna-mono)] text-xs md:ml-auto">
              SMX eXperience teCnollogy · 2026
            </span>
          </div>
        </footer>
      </Reveal>
    </SiteThemeProvider>
  );
}

/** Lua em quarto crescente: um círculo com um segundo círculo da cor do fundo
 *  deslocado por cima. Segue o fundo nos dois temas sem precisar de duas
 *  versões do desenho. */
function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="relative block h-[1.4rem] w-[1.4rem] flex-none overflow-hidden rounded-full border-[1.5px] border-[var(--luna-accent)]"
    >
      <span className="absolute -inset-0.5 -translate-x-[32%] rounded-full bg-[var(--luna-bg)]" />
    </span>
  );
}
