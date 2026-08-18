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
  type RiskState,
  type RondaFinding,
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

// missingRequiredWhenIdentified espelha `requiredWhenIdentified` de
// luna-core/src/convergia/ronda/validation.ts — divergir daqui é exatamente
// o bug que travou a ronda do Sylvamo em campo.

test("missingRequiredWhenIdentified returns empty for a non-identificado achado, even with every field blank", () => {
  const naoAvaliado: RondaFinding = { id: "f1", flagId: null, estado: "nao_avaliado" };
  const inexistente: RondaFinding = { id: "f2", flagId: null, estado: "inexistente" };
  assert.deepEqual(missingRequiredWhenIdentified(naoAvaliado), []);
  assert.deepEqual(missingRequiredWhenIdentified(inexistente), []);
});

test("missingRequiredWhenIdentified returns empty once all 4 required fields are filled", () => {
  const finding = newFinding("trabalho_em_altura", {
    departamento: "Manutenção",
    classificacao: "nao_conformidade",
    gravidade: "alta",
    descricao: "Talabarte solto",
  });
  assert.deepEqual(missingRequiredWhenIdentified(finding), []);
});

test("missingRequiredWhenIdentified without departamento and descricao returns exactly those two", () => {
  const finding = newFinding("trabalho_em_altura", { classificacao: "nao_conformidade", gravidade: "alta" });
  assert.deepEqual(missingRequiredWhenIdentified(finding), ["departamento", "descricao"]);
});

test("missingRequiredWhenIdentified never flags foto, in any state, even with no photo at all — regression lock for a rule already fixed once in the field", () => {
  const semFoto: RondaFinding = { id: "f3", flagId: "trabalho_em_altura", estado: "identificado", fotos: undefined, fotoIds: undefined };
  for (const estado of ["identificado", "nao_avaliado", "inexistente"] as const) {
    const missing = missingRequiredWhenIdentified({ ...semFoto, estado });
    assert.ok(!missing.some((field) => (field as string).startsWith("foto")), `estado=${estado} não pode listar campo de foto`);
  }
});

test("findingsWithMissingFields lists only achados with at least one missing field, finding + missing fields together", () => {
  const complete = newFinding("eletricidade", { departamento: "Manutenção", classificacao: "atencao", gravidade: "baixa", descricao: "x" });
  const incomplete = newFinding(null, { classificacao: "nao_conformidade", gravidade: "alta" });
  const result = findingsWithMissingFields([complete, incomplete]);
  assert.equal(result.length, 1);
  assert.equal(result[0].finding.id, incomplete.id);
  assert.deepEqual(result[0].missing, ["departamento", "descricao"]);
});

test("findingsWithMissingFields is empty when there is nothing to fix, including an empty findings list", () => {
  assert.deepEqual(findingsWithMissingFields([]), []);
  const complete = newFinding("eletricidade", { departamento: "Manutenção", classificacao: "atencao", gravidade: "baixa", descricao: "x" });
  assert.deepEqual(findingsWithMissingFields([complete]), []);
});

test("duplicating an incomplete achado carries the same missing fields — a duplicate never counts as already valid", () => {
  const incomplete = newFinding("eletricidade", { descricao: "Quadro exposto" });
  const copy = duplicateFinding(incomplete);
  assert.deepEqual(missingRequiredWhenIdentified(copy), missingRequiredWhenIdentified(incomplete));
  assert.equal(findingsWithMissingFields([incomplete, copy]).length, 2);
});
