import Link from "next/link";
import { ArrowRight, Smartphone } from "lucide-react";
import { SITE_CLASSIFICATION_BAR, type SiteClassification } from "@/lib/site/classification";
import { LunaCore } from "@/components/site/luna-core";

/**
 * Faixa condensada do razão, no rodapé do hero: quatro leituras, cada uma
 * com a barra na cor da própria classificação. É o resumo do que a seção
 * "Estado do sistema" desenvolve linha a linha — e é de propósito que a
 * primeira coisa acima da dobra já mostre uma não conformidade.
 *
 * Fase 1 é estático, como o razão. Ligar em `GET /api/estado` depende de
 * decidir quem calcula a classificação — ela não sai de métrica automática,
 * sai de julgamento (ver ADR-022).
 */
const STRIP: { name: string; note: string; classification: SiteClassification }[] = [
  { name: "Gateway", note: "17 capacidades respondendo", classification: "ok" },
  { name: "Memória", note: "pgvector ativo · 36 vetores", classification: "ok" },
  { name: "Cognição", note: "1 de 5 provedores ligado", classification: "warn" },
  { name: "Autorização", note: "política permissiva em uso", classification: "fail" },
];

/**
 * O degradê vive só no hero, pelo mesmo motivo que em `/ronda`: a faixa mais
 * escura fica onde a densidade de texto é maior. Abaixo do hero a página
 * assenta na cor sólida — esticar o degradê por uma página inteira
 * descaracteriza a identidade em vez de padronizá-la.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--luna-line)] bg-[image:var(--luna-bg-image)]">
      <div className="luna-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* Plano de fundo, atrás do texto — opacidade baixa e degradê de
          fusão de propósito, pra não competir com o headline/CTA. */}
      <LunaCore
        aria-hidden="true"
        className="pointer-events-none absolute right-[clamp(-4rem,-2vw,1rem)] top-1/2 z-0 aspect-[1402/1122] w-[min(46vw,640px)] -translate-y-1/2 opacity-50 [mask-image:linear-gradient(to_left,black_68%,transparent_100%)] max-md:right-1/2 max-md:top-[46%] max-md:w-[min(120vw,720px)] max-md:translate-x-1/2 max-md:opacity-25"
      />

      <div className="relative z-[1] mx-auto w-full max-w-[1240px] px-[var(--luna-pad)] pt-[clamp(3.5rem,9vw,6.5rem)]">
        <p className="luna-reveal font-[family-name:var(--luna-mono)] text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-[var(--luna-text-3)]">
          Sistema cognitivo persistente · operando em produção
        </p>

        <h1 className="luna-reveal mt-5 max-w-[16ch] text-[length:var(--luna-step-4)] font-extrabold">
          Nada do que foi
          <br />
          decidido <em className="not-italic text-[var(--luna-text-3)]">se perde.</em>
        </h1>

        <p className="luna-reveal mt-7 max-w-[58ch] text-[length:var(--luna-step-1)] leading-[1.55] text-[var(--luna-text-2)]">
          A LUNA guarda decisões, reconstrói o contexto de onde parou e opera três frentes de
          trabalho real: geração de documentos de segurança do trabalho, ronda de inspeção no
          celular e o ambiente de engenharia onde ela própria é construída.
        </p>

        <div className="luna-reveal mt-9 flex flex-wrap gap-3">
          <Link
            href="#estado"
            className="inline-flex items-center gap-2 rounded-[var(--luna-radius)] border border-[var(--luna-accent)] bg-[var(--luna-accent)] px-[1.1rem] py-2.5 text-[length:var(--luna-step--1)] font-semibold text-[var(--luna-on-accent)] transition hover:brightness-110"
          >
            Ver o estado do sistema
            <ArrowRight className="h-[15px] w-[15px]" aria-hidden="true" />
          </Link>
          <Link
            href="/ronda"
            className="inline-flex items-center gap-2 rounded-[var(--luna-radius)] border border-[var(--luna-line-2)] px-[1.1rem] py-2.5 text-[length:var(--luna-step--1)] font-medium text-[var(--luna-text)] transition hover:border-[var(--luna-line-3)] hover:bg-[var(--luna-surface)]"
          >
            <Smartphone className="h-[15px] w-[15px]" aria-hidden="true" />
            Abrir Safety Walk
          </Link>
        </div>

        <div className="luna-reveal mt-[clamp(3rem,6vw,4.5rem)] grid grid-cols-2 border-t border-[var(--luna-line-2)] md:grid-cols-4">
          {STRIP.map((cell, index) => (
            <div
              key={cell.name}
              className={`px-5 pb-[1.4rem] pt-[1.1rem] ${
                // A borda direita some na última coluna de cada quebra, e as
                // duas primeiras células ganham borda inferior no layout de
                // duas colunas — senão a grade fica com um risco solto.
                index % 2 === 1 ? "md:border-r" : "border-r"
              } ${index < 2 ? "border-b md:border-b-0" : ""} ${
                index === 3 ? "md:border-r-0" : ""
              } border-[var(--luna-line)]`}
            >
              <div
                className={`mb-[0.85rem] h-[3px] w-9 rounded-sm ${SITE_CLASSIFICATION_BAR[cell.classification]}`}
              />
              <p className="mb-0.5 text-[length:var(--luna-step--1)] font-semibold">{cell.name}</p>
              <p className="text-xs leading-[1.45] text-[var(--luna-text-3)]">{cell.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
