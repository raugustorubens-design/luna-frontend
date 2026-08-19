"use client";

import { MISSING_FIELD_LABELS, RISK_STATE_LABELS, findingTitle, type RondaFinding, type MissingField } from "@/lib/ronda/types";
import { fieldDomId, scrollToField } from "@/lib/ronda/field-anchor";

/**
 * Pacote "gate com link ao campo" — o aviso deixa de nomear achado e campos
 * em texto solto e vira lista navegável, um link por campo (nunca uma
 * contagem sozinha, e nunca "faltam campos neste achado" — o pedido foi
 * chegar no campo). Serve às duas telas que têm o gate (wizard e editor da
 * fila): quem chama decide se precisa trocar de etapa/rota antes de rolar
 * (`onNavigate`), a rolagem em si é sempre a mesma.
 */
export function MissingFieldsNotice({
  missingFieldsList,
  onNavigate,
}: {
  missingFieldsList: Array<{ finding: RondaFinding; missing: MissingField[] }>;
  /**
   * Chamado antes de rolar, síncrono — dá ao chamador a chance de levar o
   * achado para a tela (ex. `setStep("B")` no wizard, onde a Etapa C não
   * renderiza `FindingCard` nenhum). A rolagem em si só acontece dois
   * quadros depois, para o React já ter comitado e o layout já ter
   * assentado — uma rolagem só, às vezes, ainda mede a etapa anterior.
   */
  onNavigate?: (findingId: string) => void;
}) {
  const total = missingFieldsList.reduce((sum, entry) => sum + entry.missing.length, 0);
  if (total === 0) return null;

  function goTo(findingId: string, field: MissingField) {
    onNavigate?.(findingId);
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToField(findingId, field)));
  }

  return (
    <div className="rounded border border-amber-400/40 bg-amber-400/40 p-3 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-300">
      <p className="mb-2 font-medium">
        Falta{total === 1 ? "" : "m"} {total} campo{total === 1 ? "" : "s"} para concluir
      </p>
      <ul className="flex flex-col gap-2.5">
        {missingFieldsList.map(({ finding, missing }) => (
          <li key={finding.id}>
            <p className="font-medium">
              {findingTitle(finding)} · {RISK_STATE_LABELS[finding.estado]}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5 pl-3">
              {missing.map((field) => (
                <li key={field}>
                  <a
                    href={`#${fieldDomId(finding.id, field)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      goTo(finding.id, field);
                    }}
                    className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
                  >
                    → {MISSING_FIELD_LABELS[field]}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
