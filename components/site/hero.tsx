import Link from "next/link";
import { ArrowRight, Smartphone } from "lucide-react";
import { SITE_CLASSIFICATION_BAR, type SiteClassification } from "@/lib/site/classification";
import { LunaHeroVisual } from "@/components/site/luna-hero-visual";

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
 * GENESIS/pacotes/2026-08-20-hero-luna-espaco.md — cena sempre escura (ver
 * nota em `app/globals.css`, `.luna-hero-*`), LUNA inteira e centralizada
 * na primeira tela, frase abaixo dela, fundo de espaço sem quadriculado.
 * Substitui o layout anterior (LUNA como plano de fundo à direita,
 * `LunaCore` com órbita) — pré-resposta do próprio pacote: sinapses+disco
 * bastam quando a órbita não cabe no orçamento de luz do novo desenho.
 */
export function Hero() {
  return (
    <section
      id="palco"
      className="relative isolate flex min-h-[calc(100svh-3.6rem)] flex-col items-center justify-center overflow-hidden bg-[#000206] px-[clamp(1.25rem,5vw,3rem)] pb-[clamp(2.5rem,7vw,4rem)] pt-[clamp(1rem,4vw,2rem)] text-[#DCE6F2]"
    >
      <LunaHeroVisual />

      {/*
       * GENESIS/pacotes/2026-08-20-hero-desktop-e-acesso.md, item 1 —
       * `max-w-[24ch]` aqui (no wrapper) é a causa raiz do título colapsado
       * em ≥1024px: `ch` resolve contra o font-size do próprio elemento em
       * que a regra está declarada, e este `div` herda o font-size base de
       * `.luna-v2` (~15px), não o `clamp()` grande do `h1` logo abaixo. Em
       * qualquer viewport isso colapsa para ~180-200px. Em `lg:` o cap sai
       * daqui (`lg:max-w-none`) e vai para o próprio `h1`, onde `ch` passa a
       * resolver contra o font-size correto. Mobile: nada mudou.
       */}
      <div className="luna-reveal relative z-[3] mt-[clamp(1.5rem,4vw,2.5rem)] max-w-[24ch] text-center lg:max-w-none">
        <p className="font-[family-name:var(--luna-mono)] text-[0.62rem] uppercase tracking-[0.2em] text-[rgba(220,230,242,0.42)]">
          Sistema cognitivo persistente
        </p>

        {/*
         * GENESIS/pacotes/2026-08-20-hero-desktop-e-acesso.md, item 3 —
         * assinatura "LUNA", variante F aprovada pelo Arquiteto em 20/08.
         * Nomeia quem está na imagem acima e sai do caminho: não é um
         * segundo título, por isso mono/pequeno/espaçado, entre a linha de
         * sistema e o h1.
         *
         * Cor: `text-luna-warm4` (#E4B448, já um token do projeto — ver
         * tailwind.config.ts), a MESMA cor usada como "memória corroborada"
         * no sistema. Uso consciente, não engano — ver nota no corpo do PR
         * antes de trocar essa cor.
         *
         * `indent-[.62em]` some com o deslocamento à esquerda que o
         * `tracking-[.62em]` introduz (o letter-spacing empurra até a
         * última letra, sem compensar do lado esquerdo).
         */}
        <p className="mt-4 mb-[0.6rem] indent-[.62em] font-[family-name:var(--luna-mono)] text-[clamp(1.05rem,2vw,1.3rem)] font-medium tracking-[.62em] text-luna-warm4">
          LUNA
        </p>

        <h1 className="mt-4 text-balance font-[family-name:var(--luna-display)] text-[clamp(2rem,8.5vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.025em] lg:mx-auto lg:max-w-[18ch] lg:text-[clamp(2.6rem,4.2vw,4.6rem)]">
          Nada do que foi decidido{" "}
          <em className="not-italic text-[#8098B0]">se perde.</em>
        </h1>

        <p className="mx-auto mt-5 max-w-[44ch] text-[clamp(0.9rem,3.4vw,1rem)] leading-[1.62] text-[rgba(220,230,242,0.66)]">
          Ela guarda decisões, reconstrói o contexto de onde parou, e opera três frentes de
          trabalho real: geração de documentos de segurança do trabalho, ronda de inspeção no
          celular e o ambiente de engenharia onde ela própria é construída.
        </p>

        <div className="mt-[1.9rem] flex flex-wrap justify-center gap-[0.6rem]">
          <Link
            href="#estado"
            className="inline-flex items-center gap-[0.45rem] rounded-full border border-[#A0B8C8] bg-[#A0B8C8] px-5 py-[0.7rem] text-[0.85rem] font-semibold text-[#000206] transition hover:brightness-110"
          >
            Ver o estado do sistema
            <ArrowRight className="h-[15px] w-[15px]" aria-hidden="true" />
          </Link>
          <Link
            href="/ronda"
            className="inline-flex items-center gap-[0.45rem] rounded-full border border-[rgba(112,136,160,0.3)] px-5 py-[0.7rem] text-[0.85rem] font-medium text-[#DCE6F2] transition hover:border-[rgba(112,136,160,0.5)]"
          >
            <Smartphone className="h-[15px] w-[15px]" aria-hidden="true" />
            Abrir Safety Walk
          </Link>
        </div>
      </div>

      <span className="luna-hero-scroll" aria-hidden="true">
        role
      </span>
    </section>
  );
}

/**
 * Faixa de estado — mesmo conteúdo/dado de sempre (`STRIP`), fora da cena
 * escura do hero: no protótipo (`.estado`) ela já é seção irmã, não filha
 * de `.hero`, lendo os tokens normais de tema em vez da paleta fixa da
 * cena espacial. Sem `id="estado"` aqui — quem já tem esse id é a seção
 * "Estado do sistema" (`state-ledger.tsx`), que é o alvo real do link
 * "Ver o estado do sistema" acima; duplicar o id quebraria a âncora.
 */
export function HeroEstado() {
  return (
    <div className="luna-reveal mx-auto grid max-w-[1240px] grid-cols-2 gap-px bg-[var(--luna-line)] px-[var(--luna-pad)] py-[clamp(2rem,6vw,3.5rem)] md:grid-cols-4">
      {STRIP.map((cell) => (
        <div key={cell.name} className="bg-[var(--luna-bg)] p-[1.1rem]">
          <div className={`mb-3 h-[3px] w-[2.2rem] rounded-sm ${SITE_CLASSIFICATION_BAR[cell.classification]}`} />
          <p className="mb-0.5 text-[0.85rem] font-semibold">{cell.name}</p>
          <p className="text-[0.76rem] leading-[1.5] text-[var(--luna-text-3)]">{cell.note}</p>
        </div>
      ))}
    </div>
  );
}
