import assert from "node:assert/strict";
import test from "node:test";
import {
  metadataComplete,
  pendingFindings,
  missingRequiredWhenIdentified,
  findingsWithMissingFields,
  emptyMetadata,
  emptyFindings,
  newFinding,
  duplicateFinding,
  diffSuggestionFields,
  RISK_STATES,
  type RiskState,
  type RondaFinding,
  type MissingField,
  type SuggestionRecord,
} from "../types";

test("metadataComplete requires all 5 Bloco A fields non-blank", () => {
  const complete = { titulo: "Ronda A", data: "2026-08-06", local: "Planta 1", responsavel: "Ana", turno: "manhã" };
  assert.equal(metadataComplete(complete), true);
  assert.equal(metadataComplete(emptyMetadata()), false);
  assert.equal(metadataComplete({ ...complete, titulo: "   " }), false, "whitespace-only doesn't count as filled");
});

test("emptyFindings starts empty — achado dinâmico has no fixed slot per category", () => {
  assert.deepEqual(emptyFindings(), []);
});

test("newFinding creates an already-identificado achado with a fresh id", () => {
  const a = newFinding("trabalho_em_altura");
  const b = newFinding("trabalho_em_altura");
  assert.equal(a.flagId, "trabalho_em_altura");
  assert.equal(a.estado, "identificado");
  assert.notEqual(a.id, b.id, "each finding gets its own id, even for the same flag");
});

test("newFinding accepts a null flagId for a manual achado without a suggestion behind it", () => {
  const finding = newFinding(null);
  assert.equal(finding.flagId, null);
});

test("newFinding applies overrides — used to pre-fill from a suggestion's descricao", () => {
  const finding = newFinding("eletricidade", { descricao: "Quadro elétrico exposto" });
  assert.equal(finding.descricao, "Quadro elétrico exposto");
});

test("duplicateFinding copies every field except id", () => {
  const original = newFinding("trabalho_em_altura", { departamento: "Manutenção", descricao: "Talabarte solto", gravidade: "alta" });
  const copy = duplicateFinding(original);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.flagId, original.flagId);
  assert.equal(copy.departamento, original.departamento);
  assert.equal(copy.descricao, original.descricao);
  assert.equal(copy.gravidade, original.gravidade);
});

test("pendingFindings returns only nao_avaliado findings — identificado/inexistente don't block conclusion", () => {
  const findings = [
    { ...newFinding("trabalho_em_altura"), estado: "nao_avaliado" as RiskState },
    newFinding("espaco_confinado"),
    { ...newFinding("eletricidade"), estado: "inexistente" as RiskState },
  ];

  const pending = pendingFindings(findings);
  assert.equal(pending.length, 1);
  assert.ok(pending.every((f) => f.estado === "nao_avaliado"));
});

test("pendingFindings is empty once every achado is identificado or inexistente", () => {
  const findings = [newFinding("trabalho_em_altura"), { ...newFinding("espaco_confinado"), estado: "inexistente" as RiskState }];
  assert.equal(pendingFindings(findings).length, 0);
});

test("diffSuggestionFields returns empty when the saved achado matches the suggestion exactly", () => {
  const record: SuggestionRecord = { origem: "flag", flagId: "trabalho_em_altura", sugerido: { descricao: "Talabarte solto" } };
  const saved = newFinding("trabalho_em_altura", { descricao: "Talabarte solto" });
  assert.deepEqual(diffSuggestionFields(record, saved), {});
});

test("diffSuggestionFields captures only the fields the human actually changed", () => {
  const record: SuggestionRecord = {
    origem: "foto",
    sugerido: { descricao: "Sugestão original da IA", classificacao: "atencao" },
  };
  const saved = newFinding(null, { descricao: "Texto reescrito pelo humano", classificacao: "atencao", gravidade: "alta" });

  const delta = diffSuggestionFields(record, saved);
  assert.deepEqual(Object.keys(delta), ["descricao"]);
  assert.deepEqual(delta.descricao, { sugerido: "Sugestão original da IA", salvo: "Texto reescrito pelo humano" });
});

test("diffSuggestionFields ignores fields the suggestion never touched, even if the human filled them in later", () => {
  const record: SuggestionRecord = { origem: "flag", flagId: "eletricidade", sugerido: { descricao: "Quadro exposto" } };
  const saved = newFinding("eletricidade", { descricao: "Quadro exposto", gravidade: "critica", departamento: "Manutenção" });
  assert.deepEqual(diffSuggestionFields(record, saved), {});
});

/**
 * Espelha `requiredWhenIdentified` de `luna-core/src/convergia/ronda/validation.ts`
 * — achado de campo 17/08/2026: o gate do wizard (`pendingFindings`, acima)
 * só barrava "não avaliado", nunca esses 4 campos, e "Concluir ronda"
 * habilitava com achado identificado vazio, gerando 422 só depois do envio.
 */
test("missingRequiredWhenIdentified returns nothing for a não-avaliado/inexistente achado, even fully empty", () => {
  const naoAvaliado: RondaFinding = { id: "f1", estado: "nao_avaliado" };
  const inexistente: RondaFinding = { id: "f2", estado: "inexistente" };
  assert.deepEqual(missingRequiredWhenIdentified(naoAvaliado), []);
  assert.deepEqual(missingRequiredWhenIdentified(inexistente), []);
});

test("missingRequiredWhenIdentified returns nothing for an identificado achado with all 4 fields filled", () => {
  const complete = newFinding("trabalho_em_altura", {
    departamento: "Manutenção",
    classificacao: "nao_conformidade",
    gravidade: "alta",
    descricao: "Talabarte solto",
  });
  assert.deepEqual(missingRequiredWhenIdentified(complete), []);
});

test("missingRequiredWhenIdentified returns exactly the fields missing — departamento e descrição, no others", () => {
  const partial = newFinding("trabalho_em_altura", { classificacao: "nao_conformidade", gravidade: "alta" });
  assert.deepEqual(missingRequiredWhenIdentified(partial).sort(), ["departamento", "descricao"].sort());
});

/**
 * Trava a regra que já foi corrigida uma vez em campo: foto nunca é
 * obrigatória, em nenhum estado — nem quando é a única coisa preenchida num
 * achado identificado, nem em "não avaliado"/"inexistente".
 */
test("missingRequiredWhenIdentified never treats photo as required, in any state", () => {
  for (const estado of RISK_STATES) {
    const withPhotoOnly: RondaFinding = { id: `f-${estado}`, estado, fotos: [{ dataBase64: "abc", mimeType: "image/jpeg" }] };
    const missing = missingRequiredWhenIdentified(withPhotoOnly);
    assert.ok(!missing.includes("foto" as MissingField), `foto never blocks conclusion, estado=${estado}`);
  }

  // Identificado, só com foto (os 4 campos reais continuam faltando) — a foto não reduz nem substitui a exigência dos outros campos.
  const identifiedWithPhotoOnly: RondaFinding = {
    id: "f3",
    estado: "identificado",
    fotoIds: ["foto-1"],
    fotos: [{ dataBase64: "abc", mimeType: "image/jpeg" }],
  };
  assert.deepEqual(missingRequiredWhenIdentified(identifiedWithPhotoOnly).sort(), ["classificacao", "departamento", "descricao", "gravidade"].sort());
});

test("findingsWithMissingFields lists only achados that actually have something missing, with the finding attached", () => {
  const ok = newFinding("eletricidade", { departamento: "Manutenção", classificacao: "atencao", gravidade: "media", descricao: "ok" });
  const broken = newFinding(null, { descricao: "Sem departamento nem classificação" });
  const result = findingsWithMissingFields([ok, broken]);
  assert.equal(result.length, 1);
  assert.equal(result[0].finding.id, broken.id);
  assert.deepEqual(result[0].missing.sort(), ["classificacao", "departamento", "gravidade"].sort());
});
