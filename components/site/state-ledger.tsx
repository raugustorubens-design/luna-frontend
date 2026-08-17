import { ClassificationChip } from "@/components/site/classification-chip";
import {
  SITE_CLASSIFICATION_BAR,
  SITE_CLASSIFICATION_CRITERIA,
  type SiteClassification,
} from "@/lib/site/classification";

/**
 * ADR-022 — a ASSINATURA da página, e a razão de ela existir.
 *
 * A LUNA se inspeciona com a mesma classificação que usa numa planta
 * industrial, e a linha tem a mesma linguagem do cartão de achado da ronda:
 * identificador, evidência verificável, selo de classificação e uma barra na
 * cor do estado. Não é um "status page" de disponibilidade — é um razão de
 * achados sobre si mesma.
 *
 * REGRA DE CONTEÚDO (ADR-022): toda evidência aqui é verificável hoje. Não se
 * inventa linha nova nem se suaviza classificação para a página parecer
 * melhor. Se um estado mudar, a linha muda junto — inclusive para pior. Duas
 * não conformidades ficam visíveis de propósito.
 *
 * Fase 1 é estático. Ligar em `GET /api/estado` é etapa própria e depende de
 * decidir quem calcula a classificação: ela não sai de métrica automática,
 * sai de julgamento.
 */
type LedgerEntry = {
  id: string;
  organ: string;
  evidence: React.ReactNode;
  classification: SiteClassification;
};

const LEDGER: LedgerEntry[] = [
  {
    id: "ORG-01",
    organ: "Gateway",
    classification: "ok",
    evidence:
      "17 capacidades registradas, respondendo em produção. Pacotes de GitHub e sistema de arquivos completos; Railway e n8n preparados e desligados.",
  },
  {
    id: "ORG-02",
    organ: "Memória",
    classification: "ok",
    evidence: (
      <>
        Tabela{" "}
        <span className="font-[family-name:var(--luna-mono)] [font-variant-numeric:tabular-nums]">
          memoria_luna
        </span>{" "}
        no Supabase com pgvector ativo e 36 vetores confirmados. Módulo único autorizado a tocar o
        banco.
      </>
    ),
  },
  {
    id: "ORG-03",
    organ: "Safety Walk",
    classification: "ok",
    evidence:
      "Fila local, reenvio automático ao voltar a rede e recuperação de ronda interrompida. Corrigido em campo, durante ronda real, em 16 de agosto.",
  },
  {
    id: "ORG-04",
    organ: "Motor cognitivo",
    classification: "warn",
    evidence:
      "Pipeline completo e testado, mas a Constituição da LUNA não chega ao prompt: o adaptador descarta o contexto montado e envia só duas frases de instrução mais memórias truncadas.",
  },
  {
    id: "ORG-05",
    organ: "Roteador de provedores",
    classification: "warn",
    evidence:
      "Um de cinco provedores realmente configurado. A escolha é por disponibilidade — não por custo, qualidade ou latência.",
  },
  {
    id: "ORG-06",
    organ: "Hipocampo",
    classification: "warn",
    evidence:
      "Consolidação determinística v1: filtra vazio e duplicado. Sem compactação semântica — memória longa ainda é concatenada e truncada.",
  },
  {
    id: "ORG-07",
    organ: "Convergia",
    classification: "warn",
    evidence:
      "Pipeline de oito estágios verificado em produção. Três de cinco leitores e seis de sete geradores prontos; os 13 documentos corporativos estão catalogados, nenhum com conteúdo validado por especialista.",
  },
  {
    id: "ORG-08",
    organ: "Autorização do Gateway",
    classification: "fail",
    evidence:
      "Política permissiva ainda em uso: toda capacidade executa sem verificação de identidade. Bloqueia qualquer capacidade destrutiva de ir a produção.",
  },
  {
    id: "ORG-09",
    organ: "Reporter",
    classification: "fail",
    evidence:
      "Varre o GitHub e para por aí. Sem leitura de Supabase nem de Railway, e sem nenhum consumidor confirmado — o organismo não se observa sozinho.",
  },
];

const LEGEND: SiteClassification[] = ["ok", "warn", "fail"];

const HEAD_CLASS = "grid gap-4 md:grid-cols-[5.5rem_1fr_9.5rem]";

export function StateLedger() {
  return (
    <section id="estado" className="border-b border-[var(--luna-line)] py-[clamp(4rem,9vw,7rem)]">
      <div className="mx-auto w-full max-w-[1240px] px-[var(--luna-pad)]">
        <div className="luna-reveal mb-11 flex flex-wrap items-baseline gap-5">
          <h2 className="text-[length:var(--luna-step-3)]">Estado do sistema</h2>
          <p className="max-w-[46ch] text-[length:var(--luna-step--1)] text-[var(--luna-text-2)]">
            A LUNA se inspeciona com a mesma classificação que usa numa planta industrial: conforme,
            atenção, não conforme. Nada é omitido para a página parecer melhor.
          </p>
        </div>

        <div className="luna-ledger overflow-hidden rounded-[var(--luna-radius)] border border-[var(--luna-line-2)] bg-[var(--luna-surface)]">
          {/* O cabeçalho some no celular: a linha vira bloco empilhado, e um
              cabeçalho de três colunas sobre um bloco de uma só é ruído. */}
          <div
            className={`${HEAD_CLASS} hidden border-b border-[var(--luna-line-2)] bg-[var(--luna-surface-2)] px-5 py-2.5 md:grid`}
          >
            {["Órgão", "Evidência", "Classificação"].map((label) => (
              <span
                key={label}
                className="font-[family-name:var(--luna-mono)] text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-[var(--luna-text-3)]"
              >
                {label}
              </span>
            ))}
          </div>

          {LEDGER.map((entry) => (
            <div
              key={entry.id}
              data-c={entry.classification}
              className={`luna-ledger-row ${HEAD_CLASS} relative items-start gap-2 border-b border-[var(--luna-line)] px-5 py-[1.05rem] last:border-b-0 md:gap-4`}
            >
              <span className="font-[family-name:var(--luna-mono)] text-xs text-[var(--luna-text-3)] md:pt-0.5">
                {entry.id}
              </span>
              <div>
                <p className="mb-0.5 text-[length:var(--luna-step-0)] font-semibold">
                  {entry.organ}
                </p>
                <p className="max-w-[64ch] text-[0.8125rem] leading-[1.5] text-[var(--luna-text-2)]">
                  {entry.evidence}
                </p>
              </div>
              <ClassificationChip classification={entry.classification} className="justify-self-start" />
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-5 border-t border-[var(--luna-line-2)] bg-[var(--luna-surface-2)] px-5 py-3.5">
            {LEGEND.map((classification) => (
              <span
                key={classification}
                className="flex items-center gap-2 text-xs text-[var(--luna-text-2)]"
              >
                <i
                  aria-hidden="true"
                  className={`block h-[0.7rem] w-[0.7rem] rounded-sm ${SITE_CLASSIFICATION_BAR[classification]}`}
                />
                {SITE_CLASSIFICATION_CRITERIA[classification]}
              </span>
            ))}
            <span className="font-[family-name:var(--luna-mono)] text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-[var(--luna-text-3)] md:ml-auto">
              Última verificação · 17 ago 2026
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
