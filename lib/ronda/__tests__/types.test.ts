import assert from "node:assert/strict";
import test from "node:test";
import { metadataComplete, pendingCategories, emptyMetadata, emptyFindings, RISK_CATEGORIES, type RiskState } from "../types";

test("metadataComplete requires all 5 Bloco A fields non-blank", () => {
  const complete = { titulo: "Ronda A", data: "2026-08-06", local: "Planta 1", responsavel: "Ana", turno: "manhã" };
  assert.equal(metadataComplete(complete), true);
  assert.equal(metadataComplete(emptyMetadata()), false);
  assert.equal(metadataComplete({ ...complete, titulo: "   " }), false, "whitespace-only doesn't count as filled");
});

test("emptyFindings covers all 7 risk categories, all starting nao_avaliado", () => {
  const findings = emptyFindings();
  assert.equal(findings.length, RISK_CATEGORIES.length);
  assert.ok(findings.every((f) => f.estado === "nao_avaliado"));
  assert.deepEqual(
    findings.map((f) => f.categoria).sort(),
    [...RISK_CATEGORIES].sort(),
  );
});

test("pendingCategories returns only nao_avaliado findings — identificado/inexistente don't block conclusion", () => {
  const findings = emptyFindings();
  findings[0].estado = "identificado";
  findings[1].estado = "inexistente";

  const pending = pendingCategories(findings);
  assert.equal(pending.length, findings.length - 2);
  assert.ok(pending.every((f) => f.estado === "nao_avaliado"));
});

test("pendingCategories is empty once every category is identificado or inexistente", () => {
  const findings = emptyFindings().map((f, i) => ({ ...f, estado: (i % 2 === 0 ? "identificado" : "inexistente") as RiskState }));
  assert.equal(pendingCategories(findings).length, 0);
});
