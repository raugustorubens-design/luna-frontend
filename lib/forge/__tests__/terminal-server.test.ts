import assert from "node:assert/strict";
import test from "node:test";
import { verifyTerminalClient } from "../terminal-server";

test("verifyTerminalClient always allows connections in development", () => {
  const result = verifyTerminalClient(true, undefined, "/forge/terminal", null, undefined);
  assert.deepEqual(result, { allowed: true });
});

test("verifyTerminalClient denies every connection in production with no session", () => {
  const result = verifyTerminalClient(false, "secret-token", "/forge/terminal?token=secret-token", null, "me@example.com");
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, 401);
});

test("verifyTerminalClient denies a session whose email is not the allowed one", () => {
  const result = verifyTerminalClient(false, "secret-token", "/forge/terminal?token=secret-token", "someone-else@example.com", "me@example.com");
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, 401);
});

test("verifyTerminalClient denies every connection in production when no token is configured, even with a valid session", () => {
  const result = verifyTerminalClient(false, undefined, "/forge/terminal", "me@example.com", "me@example.com");
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, 503);
});

test("verifyTerminalClient denies a valid session with no token in production", () => {
  const result = verifyTerminalClient(false, "secret-token", "/forge/terminal", "me@example.com", "me@example.com");
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, 401);
});

test("verifyTerminalClient denies a valid session with the wrong token in production", () => {
  const result = verifyTerminalClient(false, "secret-token", "/forge/terminal?token=wrong", "me@example.com", "me@example.com");
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, 401);
});

test("verifyTerminalClient allows a valid session with the matching token in production", () => {
  const result = verifyTerminalClient(false, "secret-token", "/forge/terminal?token=secret-token", "me@example.com", "me@example.com");
  assert.deepEqual(result, { allowed: true });
});

test("verifyTerminalClient handles a token containing URL-encoded characters", () => {
  const token = "abc+def/123==";
  const result = verifyTerminalClient(
    false,
    token,
    `/forge/terminal?token=${encodeURIComponent(token)}`,
    "me@example.com",
    "me@example.com",
  );
  assert.deepEqual(result, { allowed: true });
});

test("verifyTerminalClient email match is case-insensitive and trims whitespace", () => {
  const result = verifyTerminalClient(false, "secret-token", "/forge/terminal?token=secret-token", "  ME@Example.com  ", "me@example.com");
  assert.deepEqual(result, { allowed: true });
});
