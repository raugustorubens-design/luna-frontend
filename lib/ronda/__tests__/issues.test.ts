import assert from "node:assert/strict";
import test from "node:test";
import { parseIssuePath, isRecoverableRejection, groupIssuesByFinding } from "../issues";

test("parseIssuePath extracts findingId and field from a valid achados.{id}.{campo} path", () => {
  assert.deepEqual(parseIssuePath({ path: "achados.abc-123.departamento", message: "departamento é obrigatório quando o risco foi identificado" }), {
    findingId: "abc-123",
    field: "departamento",
  });
});

test("parseIssuePath returns null for a metadata path — it never starts with achados", () => {
  assert.equal(parseIssuePath({ path: "metadata.titulo", message: "título é obrigatório" }), null);
});

test("parseIssuePath returns null for malformed paths — empty, or achados with no field segment", () => {
  assert.equal(parseIssuePath({ path: "", message: "x" }), null);
  assert.equal(parseIssuePath({ path: "achados", message: "x" }), null);
  // Formato do id duplicado (`achados.${id}`, sem campo) — 2 segmentos, sem campo pra destacar.
  assert.equal(parseIssuePath({ path: "achados.abc-123", message: `id de achado "abc-123" aparece 2 vezes` }), null);
});

test("parseIssuePath handles an achado id that itself contains a dot — field is always the last segment", () => {
  assert.deepEqual(parseIssuePath({ path: "achados.abc.def.classificacao", message: "classificação é obrigatória" }), {
    findingId: "abc.def",
    field: "classificacao",
  });
});

test("isRecoverableRejection is false with no issues at all — item invalid before this fix, or genuinely unrecoverable", () => {
  assert.equal(isRecoverableRejection(undefined), false);
  assert.equal(isRecoverableRejection([]), false);
});

test("isRecoverableRejection is true when every issue points at one of the 4 required fields", () => {
  assert.equal(
    isRecoverableRejection([
      { path: "achados.f1.departamento", message: "departamento é obrigatório quando o risco foi identificado" },
      { path: "achados.f1.descricao", message: "descrição é obrigatória quando o risco foi identificado" },
    ]),
    true,
  );
});

test("isRecoverableRejection is false for a pre-migração payload — achados.N.id missing marks it unrecoverable", () => {
  assert.equal(isRecoverableRejection([{ path: "achados.0.id", message: "Required" }]), false);
});

test("isRecoverableRejection is false when even one issue isn't a known required field (mixed payload)", () => {
  assert.equal(
    isRecoverableRejection([
      { path: "achados.f1.departamento", message: "departamento é obrigatório quando o risco foi identificado" },
      { path: "achados.f1", message: `id de achado "f1" aparece 2 vezes` },
    ]),
    false,
  );
});

test("groupIssuesByFinding buckets by known finding id + field, and puts the rest in unmapped verbatim", () => {
  const findingIds = new Set(["f1"]);
  const { byFinding, unmapped } = groupIssuesByFinding(
    [
      { path: "achados.f1.departamento", message: "departamento é obrigatório quando o risco foi identificado" },
      { path: "achados.f1.descricao", message: "descrição é obrigatória quando o risco foi identificado" },
      // id que não existe mais na lista carregada — não pode acender um card que não está na tela.
      { path: "achados.f2.departamento", message: "departamento é obrigatório quando o risco foi identificado" },
      { path: "achados.0.id", message: "Required" },
    ],
    findingIds,
  );

  assert.deepEqual(byFinding.get("f1"), {
    departamento: "departamento é obrigatório quando o risco foi identificado",
    descricao: "descrição é obrigatória quando o risco foi identificado",
  });
  assert.equal(byFinding.has("f2"), false);
  assert.equal(unmapped.length, 2);
  assert.ok(unmapped.some((issue) => issue.path === "achados.f2.departamento"));
  assert.ok(unmapped.some((issue) => issue.path === "achados.0.id"));
});
