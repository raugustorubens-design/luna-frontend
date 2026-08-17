import assert from "node:assert/strict";
import test from "node:test";
import {
  metadataComplete,
  pendingFindings,
  emptyMetadata,
  emptyFindings,
  newFinding,
  duplicateFinding,
  diffSuggestionFields,
  missingRequiredWhenIdentified,
  findingsWithMissingFields,
  type RiskState,
  type SuggestionRecord,
  type RondaFinding,
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

// Gate divergente de 17/08/2026 — GENESIS_2026-08-17_URGENTE_gate-ronda-divergente.md.
// Espelha requiredWhenIdentified() de luna-core/src/convergia/ronda/validation.ts.

test("missingRequiredWhenIdentified returns empty for an achado that isn't identificado, even with every field blank", () => {
  const finding: RondaFinding = { id: "f1", flagId: null, estado: "nao_avaliado" };
  assert.deepEqual(missingRequiredWhenIdentified(finding), []);

  const inexistente: RondaFinding = { id: "f2", flagId: null, estado: "inexistente" };
  assert.deepEqual(missingRequiredWhenIdentified(inexistente), []);
});

test("missingRequiredWhenIdentified returns empty once the four required fields are filled", () => {
  const finding = newFinding("eletricidade", {
    departamento: "Manutenção",
    classificacao: "nao_conformidade",
    gravidade: "alta",
    descricao: "Quadro elétrico exposto",
  });
  assert.deepEqual(missingRequiredWhenIdentified(finding), []);
});

test("missingRequiredWhenIdentified names exactly the fields that are missing — the 17/08 field case: departamento and descrição blank, classificação and gravidade filled", () => {
  const finding = newFinding(null, { classificacao: "nao_conformidade", gravidade: "alta" });
  assert.deepEqual(missingRequiredWhenIdentified(finding), ["departamento", "descricao"]);
});

test("missingRequiredWhenIdentified never lists foto — required-photo was a usability fix over the real Manserv tool, and it was reverted once already; this locks the regression", () => {
  // Achado identificado, todos os 4 campos exigidos preenchidos, nenhuma foto anexada.
  const finding = newFinding("trabalho_em_altura", {
    departamento: "Operações",
    classificacao: "positivo",
    gravidade: "baixa",
    descricao: "Uso correto do cinto de segurança",
  });
  assert.deepEqual(finding.fotos, undefined);
  assert.deepEqual(finding.fotoIds, undefined);
  assert.deepEqual(missingRequiredWhenIdentified(finding), [], "sem foto nenhuma, ainda assim nada obrigatório falta");

  // A prova de que "foto" nunca é uma das strings possíveis, em nenhum estado.
  const empty: RondaFinding = { id: "f3", flagId: null, estado: "identificado" };
  assert.ok(!missingRequiredWhenIdentified(empty).includes("foto" as never));
});

test("findingsWithMissingFields lists only the achados that are actually incomplete, each paired with its own missing fields", () => {
  const complete = newFinding("eletricidade", {
    departamento: "Manutenção",
    classificacao: "atencao",
    gravidade: "media",
    descricao: "Fiação exposta",
  });
  const incomplete = newFinding(null, { classificacao: "nao_conformidade" });
  const notYetIdentified: RondaFinding = { id: "f4", flagId: null, estado: "nao_avaliado" };

  const result = findingsWithMissingFields([complete, incomplete, notYetIdentified]);
  assert.equal(result.length, 1);
  assert.equal(result[0].finding.id, incomplete.id);
  assert.deepEqual(result[0].missing, ["departamento", "gravidade", "descricao"]);
});

test("duplicateFinding copies an incomplete achado as incomplete — the gate must catch it too, not treat a duplicate as pre-validated", () => {
  const original = newFinding(null, { classificacao: "positivo" });
  const copy = duplicateFinding(original);
  assert.notEqual(copy.id, original.id);
  assert.deepEqual(missingRequiredWhenIdentified(copy), missingRequiredWhenIdentified(original));
  assert.deepEqual(missingRequiredWhenIdentified(copy), ["departamento", "gravidade", "descricao"]);
});
