import assert from "node:assert/strict";
import test from "node:test";
import { parseIssuePath, mapIssuesToFindings, isOldFormatRejection, canDiscardInvalidItem } from "../issues";
import { newFinding, type RondaFinding } from "../types";

test("parseIssuePath parses a valid achado field path", () => {
  assert.deepEqual(parseIssuePath("achados.abc123.departamento"), { findingId: "abc123", field: "departamento" });
});

test("parseIssuePath returns null for a metadata path — not an achado field", () => {
  assert.equal(parseIssuePath("metadata.titulo"), null);
  assert.equal(parseIssuePath("achados"), null, "top-level achados issue (ex. duplicate id count) has no field to address");
});

test("parseIssuePath returns null for malformed paths", () => {
  assert.equal(parseIssuePath(""), null);
  assert.equal(parseIssuePath("achados."), null, "empty rest after prefix");
  assert.equal(parseIssuePath("achados.x."), null, "trailing dot, no field");
  assert.equal(parseIssuePath("achados..departamento"), null, "empty findingId");
});

test("parseIssuePath splits on the last dot — an achado id containing a dot is still parsed correctly", () => {
  assert.deepEqual(parseIssuePath("achados.abc.def.descricao"), { findingId: "abc.def", field: "descricao" });
});

test("mapIssuesToFindings groups issues by achado id, field -> server message", () => {
  const { byFinding, unmapped } = mapIssuesToFindings(
    [
      { path: "achados.f1.departamento", message: "departamento é obrigatório quando o risco foi identificado" },
      { path: "achados.f1.descricao", message: "descrição é obrigatória quando o risco foi identificado" },
      { path: "achados.f2.gravidade", message: "gravidade é obrigatória quando o risco foi identificado" },
    ],
    new Set(["f1", "f2"]),
  );
  assert.deepEqual(byFinding, {
    f1: { departamento: "departamento é obrigatório quando o risco foi identificado", descricao: "descrição é obrigatória quando o risco foi identificado" },
    f2: { gravidade: "gravidade é obrigatória quando o risco foi identificado" },
  });
  assert.deepEqual(unmapped, []);
});

test("mapIssuesToFindings puts metadata issues and issues for an id not in the ronda into unmapped", () => {
  const { byFinding, unmapped } = mapIssuesToFindings(
    [
      { path: "metadata.titulo", message: "título é obrigatório" },
      { path: "achados.nao-existe-mais.descricao", message: "descrição é obrigatória quando o risco foi identificado" },
    ],
    new Set(["f1"]),
  );
  assert.deepEqual(byFinding, {});
  assert.equal(unmapped.length, 2);
});

test("isOldFormatRejection is true when there are no stored issues — item went invalid before issues were persisted", () => {
  assert.equal(isOldFormatRejection(undefined), true);
  assert.equal(isOldFormatRejection([]), true);
});

test("isOldFormatRejection is true for a pre-migration payload — issue on achados.N.id", () => {
  assert.equal(isOldFormatRejection([{ path: "achados.0.id", message: "Required" }]), true);
});

test("isOldFormatRejection is false for a recoverable rejection — issues on required fields, not id", () => {
  assert.equal(
    isOldFormatRejection([
      { path: "achados.f1.departamento", message: "departamento é obrigatório quando o risco foi identificado" },
      { path: "achados.f1.descricao", message: "descrição é obrigatória quando o risco foi identificado" },
    ]),
    false,
  );
});

/**
 * Achado 2 da revisão da branch: `isOldFormatRejection` usa `.some()`, então
 * um payload misto (uma issue de campo real + uma de `achados.N.id`) já
 * classifica como "formato antigo" na mensagem — mas `canDiscardInvalidItem`
 * precisa ser mais conservador, porque ainda há um campo corrigível na tela.
 */
test("canDiscardInvalidItem is false when nothing is missing per the client gate but a server issue still maps to a loaded finding — even in a mixed payload with an id issue too", () => {
  const achado = newFinding("trabalho_em_altura", { id: "f1" }); // identificado, tudo vazio ainda no cliente (não usado aqui — issues do servidor é que decidem)
  const achados: RondaFinding[] = [{ ...achado, departamento: "Manutenção", classificacao: "atencao", gravidade: "baixa", descricao: "ok" }];
  const mixedIssues = [
    { path: "achados.f1.departamento", message: "departamento é obrigatório quando o risco foi identificado" },
    { path: "achados.0.id", message: "Required" },
  ];
  assert.equal(canDiscardInvalidItem(achados, mixedIssues), false);
});

test("canDiscardInvalidItem is false when the client gate itself finds a missing field, regardless of issues", () => {
  const incomplete = [newFinding("trabalho_em_altura", { id: "f1", classificacao: "atencao" })]; // sem departamento/gravidade/descricao
  assert.equal(canDiscardInvalidItem(incomplete, undefined), false);
});

test("canDiscardInvalidItem is true only when there's truly nothing to fix here — no client-side missing field and no issue maps to a loaded achado", () => {
  const complete = [newFinding("trabalho_em_altura", { id: "f1", departamento: "Manutenção", classificacao: "atencao", gravidade: "baixa", descricao: "ok" })];
  assert.equal(canDiscardInvalidItem(complete, undefined), true, "no issues at all, nothing missing client-side — genuinely stuck, pre-migration item");
  assert.equal(
    canDiscardInvalidItem(complete, [{ path: "achados.0.id", message: "Required" }]),
    true,
    "old-format issue that doesn't address any currently-loaded achado",
  );
  assert.equal(
    canDiscardInvalidItem(complete, [{ path: "achados.f1.departamento", message: "departamento é obrigatório quando o risco foi identificado" }]),
    false,
    "issue maps to a real, currently-loaded field — still fixable",
  );
});
