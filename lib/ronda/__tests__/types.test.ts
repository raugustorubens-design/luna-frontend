import assert from "node:assert/strict";
import test from "node:test";
import { metadataComplete, pendingFindings, emptyMetadata, emptyFindings, newFinding, duplicateFinding, type RiskState } from "../types";

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
