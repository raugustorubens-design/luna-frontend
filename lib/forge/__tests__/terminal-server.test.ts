import assert from "node:assert/strict";
import test from "node:test";
import { verifyTerminalClient } from "../terminal-server";

test("verifyTerminalClient always allows connections in development", () => {
  const result = verifyTerminalClient(true, undefined, "/forge/terminal");
  assert.deepEqual(result, { allowed: true });
});

test("verifyTerminalClient denies every connection in production when no token is configured", () => {
  const result = verifyTerminalClient(false, undefined, "/forge/terminal");
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, 503);
});

test("verifyTerminalClient denies a connection with no token in production", () => {
  const result = verifyTerminalClient(false, "secret-token", "/forge/terminal");
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, 401);
});

test("verifyTerminalClient denies a connection with the wrong token in production", () => {
  const result = verifyTerminalClient(false, "secret-token", "/forge/terminal?token=wrong");
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, 401);
});

test("verifyTerminalClient allows a connection with the matching token in production", () => {
  const result = verifyTerminalClient(false, "secret-token", "/forge/terminal?token=secret-token");
  assert.deepEqual(result, { allowed: true });
});

test("verifyTerminalClient handles a token containing URL-encoded characters", () => {
  const token = "abc+def/123==";
  const result = verifyTerminalClient(false, token, `/forge/terminal?token=${encodeURIComponent(token)}`);
  assert.deepEqual(result, { allowed: true });
});
