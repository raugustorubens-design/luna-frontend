import assert from "node:assert/strict";
import test from "node:test";
import { fieldDomId } from "../field-anchor";
import { parseIssuePath } from "../issues";

// Pacote "gate com link ao campo" (GENESIS/pacotes/2026-08-19-gate-com-
// link-ao-campo.md) — a exigência central da Etapa 3: "nunca escrever o
// formato do id à mão em nenhum dos dois lados". Este teste confirma que o
// id que o card monta (deteção do cliente) e o id que se monta a partir do
// que o servidor devolveu (`parseIssuePath`, o 422) são idênticos, para o
// mesmo achado e campo — é isso que faz o link do aviso apontar pro campo
// certo nos dois casos em que ele pode aparecer.

test("fieldDomId é estável — mesma entrada, mesmo id, sempre", () => {
  assert.equal(fieldDomId("achado-1", "departamento"), fieldDomId("achado-1", "departamento"));
});

test("fieldDomId — o id da detecção do cliente bate com o id derivado de parseIssuePath, para o mesmo achado e campo", () => {
  const findingId = "3fa1c2e0-...";
  const field = "descricao";

  const idDoCliente = fieldDomId(findingId, field);

  const parsed = parseIssuePath(`achados.${findingId}.${field}`);
  assert.ok(parsed);
  const idDoServidor = fieldDomId(parsed.findingId, parsed.field as typeof field);

  assert.equal(idDoCliente, idDoServidor);
});

test("fieldDomId — achados diferentes ou campos diferentes nunca colidem", () => {
  assert.notEqual(fieldDomId("achado-1", "departamento"), fieldDomId("achado-2", "departamento"));
  assert.notEqual(fieldDomId("achado-1", "departamento"), fieldDomId("achado-1", "descricao"));
});

test("fieldDomId — sobrevive a um id de achado com ponto (mesmo caso que parseIssuePath trata separando pelo último ponto)", () => {
  const findingId = "id.com.ponto";
  const path = `achados.${findingId}.gravidade`;
  const parsed = parseIssuePath(path);
  assert.ok(parsed);
  assert.equal(parsed.findingId, findingId);
  assert.equal(fieldDomId(findingId, "gravidade"), fieldDomId(parsed.findingId, parsed.field as "gravidade"));
});
