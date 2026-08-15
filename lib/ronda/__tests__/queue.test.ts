import assert from "node:assert/strict";
import test from "node:test";
import { isPermanentRejection } from "../queue";
import { RondaSubmitError } from "../api-client";

test("isPermanentRejection is true for a 422 validation rejection", () => {
  assert.equal(isPermanentRejection(new RondaSubmitError("Envio de ronda reprovado na validação.", [{ path: "achados.0.id", message: "Required" }], 422)), true);
});

test("isPermanentRejection is false for a network/5xx failure", () => {
  assert.equal(isPermanentRejection(new RondaSubmitError("Falha ao enviar ronda (HTTP 500).", undefined, 500)), false);
  assert.equal(isPermanentRejection(new TypeError("Failed to fetch")), false);
  assert.equal(isPermanentRejection(new RondaSubmitError("sem status")), false);
});
