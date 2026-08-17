import assert from "node:assert/strict";
import test from "node:test";
import { parseIssuePath, classifyQueueRejection } from "../issues";

// Gate divergente de 17/08/2026 — GENESIS_2026-08-17_URGENTE_gate-ronda-divergente.md.

test("parseIssuePath — caminho válido de campo obrigatório", () => {
  assert.deepEqual(parseIssuePath("achados.abc123.departamento"), { findingId: "abc123", field: "departamento" });
  assert.deepEqual(parseIssuePath("achados.abc123.classificacao"), { findingId: "abc123", field: "classificacao" });
  assert.deepEqual(parseIssuePath("achados.abc123.gravidade"), { findingId: "abc123", field: "gravidade" });
  assert.deepEqual(parseIssuePath("achados.abc123.descricao"), { findingId: "abc123", field: "descricao" });
});

test("parseIssuePath — caminho de metadado não casa (não é achado nenhum)", () => {
  assert.equal(parseIssuePath("metadata.titulo"), null);
  assert.equal(parseIssuePath("encerramento.observacoesGerais"), null);
});

test("parseIssuePath — caminho malformado devolve null em vez de lançar", () => {
  assert.equal(parseIssuePath("achados"), null, "achados sem sufixo nenhum");
  assert.equal(parseIssuePath("achados.abc"), null, "achados com id mas sem campo");
  assert.equal(parseIssuePath(""), null);
  // Formato pré-migração (BUILDER.md 15/08): campo "id", não um dos 4 obrigatórios — não confundir com achado dinâmico.
  assert.equal(parseIssuePath("achados.0.id"), null);
});

test("parseIssuePath — id de achado contendo ponto ainda é reconhecido, porque o campo é âncora do fim da string, não o próximo ponto", () => {
  assert.deepEqual(parseIssuePath("achados.v1.2.3.descricao"), { findingId: "v1.2.3", field: "descricao" });
});

test("classifyQueueRejection — sem issues (ou vazio) é sempre unrecoverable, mesmo comportamento do fix de 15/08", () => {
  assert.equal(classifyQueueRejection(undefined), "unrecoverable");
  assert.equal(classifyQueueRejection([]), "unrecoverable");
});

test("classifyQueueRejection — toda issue mapeando pra um campo obrigatório é recoverable", () => {
  const issues = [
    { path: "achados.f1.departamento", message: "Required" },
    { path: "achados.f1.descricao", message: "Required" },
  ];
  assert.equal(classifyQueueRejection(issues), "recoverable");
});

test("classifyQueueRejection — formato pré-migração (achados.N.id) é unrecoverable", () => {
  assert.equal(classifyQueueRejection([{ path: "achados.0.id", message: "Required" }]), "unrecoverable");
});

test("classifyQueueRejection — mistura de issue mapeável e não mapeável fica unrecoverable, por segurança", () => {
  const issues = [
    { path: "achados.f1.departamento", message: "Required" },
    { path: "metadata.titulo", message: "Required" },
  ];
  assert.equal(classifyQueueRejection(issues), "unrecoverable");
});
