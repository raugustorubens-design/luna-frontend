import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedEmail } from "../allowed-email";

test("isAllowedEmail returns true for an exact match", () => {
  assert.equal(isAllowedEmail("me@example.com", "me@example.com"), true);
});

test("isAllowedEmail is case-insensitive", () => {
  assert.equal(isAllowedEmail("Me@Example.com", "me@example.com"), true);
});

test("isAllowedEmail trims surrounding whitespace on both sides", () => {
  assert.equal(isAllowedEmail("  me@example.com  ", " me@example.com "), true);
});

test("isAllowedEmail rejects a different email", () => {
  assert.equal(isAllowedEmail("someone-else@example.com", "me@example.com"), false);
});

test("isAllowedEmail rejects when the session has no email", () => {
  assert.equal(isAllowedEmail(null, "me@example.com"), false);
  assert.equal(isAllowedEmail(undefined, "me@example.com"), false);
});

test("isAllowedEmail rejects when no allowlist is configured, even if an email is present", () => {
  assert.equal(isAllowedEmail("me@example.com", undefined), false);
});

// Etapa 3 de `2026-08-19-acesso-publico.md`: RONDA_ALLOWED_EMAILS é lista
// separada por vírgula, plural — mesma função de FORGE_ALLOWED_EMAIL
// (conta única), já que um e-mail sozinho é só uma lista de um elemento.
test("isAllowedEmail matches any email in a comma-separated list", () => {
  assert.equal(isAllowedEmail("tecnico2@example.com", "tecnico1@example.com,tecnico2@example.com,tecnico3@example.com"), true);
});

test("isAllowedEmail trims whitespace around each element of a comma-separated list", () => {
  assert.equal(isAllowedEmail("tecnico2@example.com", "tecnico1@example.com, tecnico2@example.com , tecnico3@example.com"), true);
});

test("isAllowedEmail is case-insensitive across a comma-separated list", () => {
  assert.equal(isAllowedEmail("Tecnico2@Example.com", "tecnico1@example.com,tecnico2@example.com"), true);
});

test("isAllowedEmail rejects an email not present in a comma-separated list", () => {
  assert.equal(isAllowedEmail("intruso@example.com", "tecnico1@example.com,tecnico2@example.com"), false);
});

test("isAllowedEmail tolerates a trailing comma or empty element in the list without matching an empty string", () => {
  assert.equal(isAllowedEmail("", "tecnico1@example.com,"), false);
});
