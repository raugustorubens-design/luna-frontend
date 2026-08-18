import { FileText, Layers, Radar, Smartphone, type LucideIcon } from "lucide-react";
import { ClassificationChip } from "@/components/site/classification-chip";
import type { SiteClassification } from "@/lib/site/classification";

/**
 * As quatro frentes, classificadas pela mesma régua da ronda. Duas já
 * entregam documento e dado em campo; duas ainda estão sendo construídas — e
 * a página diz qual é qual, inclusive quando a resposta é "não conforme".
 *
 * `falta` não é uma nota de rodapé: é a metade da linha que impede o cartão
 * de virar peça de marketing. Se um estado mudar, a linha muda junto — não se
 * suaviza classificação para a página parecer melhor.
 */
type Product = {
  name: string;
  icon: LucideIcon;
  classification: SiteClassification;
  line: string;
  meta: { term: string; value: string }[];
};

const PRODUCTS: Product[] = [
  {
    name: "Convergia",
    icon: FileText,
    classification: "warn",
    line: "Planilha e modelo entram, documentos prontos saem. Um ASO por trabalhador, uma carteirinha por operador, um relatório por turno — sem copiar e colar.",
    meta: [
      { term: "Entra", value: "XLSX, CSV, JSON" },
      { term: "Sai", value: "PPTX, DOCX, XLSX, PDF" },
      { term: "Falta", value: "Modelos de conteúdo dos 13 documentos catalogados" },
    ],
  },
  {
    name: "Safety Walk",
    icon: Smartphone,
    classification: "ok",
    line: "Ronda de segurança no celular. Funciona sem sinal: o achado fica no aparelho e sobe sozinho quando a rede volta.",
    meta: [
      { term: "Entra", value: "Foto, achado, classificação" },
      { term: "Sai", value: "Relatório detalhado ou visual" },
      { term: "Campo", value: "Usado em ronda real desde agosto" },
    ],
  },
  {
    name: "Forge",
    icon: Layers,
    classification: "warn",
    line: "O ambiente onde a LUNA é construída. Editor, versionamento, terminal e conversa no mesmo lugar — com a memória do projeto sempre à mão.",
    meta: [
      { term: "Tem", value: "Editor, Git, terminal, chat, Convergia" },
      { term: "Falta", value: "Merge de PR, seleção de provedor, diagnóstico" },
      { term: "Etapa", value: "MVP-03 em andamento" },
    ],
  },
  {
    name: "Reporter",
    icon: Radar,
    classification: "fail",
    line: "Deveria dizer, sem ninguém perguntar, o que está travado e qual é a próxima ação de maior impacto. Hoje só enxerga o GitHub.",
    meta: [
      { term: "Tem", value: "Varredura de repositórios" },
      { term: "Falta", value: "Leitura de Supabase e Railway" },
      { term: "Etapa", value: "Escopo parcial, sem consumidor" },
    ],
  },
];

export function Products() {
  return (
    <section
      id="produtos"
      className="border-b border-[var(--luna-line)] py-[clamp(4rem,9vw,7rem)]"
    >
      <div className="mx-auto w-full max-w-[1240px] px-[var(--luna-pad)]">
        <div className="luna-reveal mb-11 flex flex-wrap items-baseline gap-5">
          <h2 className="text-[length:var(--luna-step-3)]">O que a LUNA faz hoje</h2>
          <p className="max-w-[46ch] text-[length:var(--luna-step--1)] text-[var(--luna-text-2)]">
            Quatro frentes. Duas já entregam documento e dado em campo; duas ainda estão sendo
            construídas — e a página diz qual é qual.
          </p>
        </div>

        {/* A grade em `gap: 1px` sobre o fundo da linha desenha as divisórias
            sem uma borda por cartão — assim nenhuma linha fica dobrada nas
            junções. */}
        <div className="luna-reveal grid gap-px overflow-hidden rounded-[var(--luna-radius)] border border-[var(--luna-line)] bg-[var(--luna-line)] sm:grid-cols-2 xl:grid-cols-4">
          {PRODUCTS.map((product) => (
            <article
              key={product.name}
              className="flex min-h-[19rem] flex-col gap-3.5 bg-[var(--luna-bg)] px-6 pb-6 pt-7 transition-colors hover:bg-[var(--luna-surface)]"
            >
              <div className="flex items-center justify-between gap-2">
                <product.icon
                  className="h-5 w-5 text-[var(--luna-text-2)]"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <ClassificationChip classification={product.classification} />
              </div>

              <h3 className="text-[length:var(--luna-step-1)]">{product.name}</h3>
              <p className="text-[length:var(--luna-step--1)] leading-[1.55] text-[var(--luna-text-2)]">
                {product.line}
              </p>

              <div className="mt-auto border-t border-[var(--luna-line)] pt-4">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  {product.meta.map((entry) => (
                    <div key={entry.term} className="contents">
                      <dt className="font-[family-name:var(--luna-mono)] text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--luna-text-3)]">
                        {entry.term}
                      </dt>
                      <dd className="text-xs text-[var(--luna-text-2)]">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
