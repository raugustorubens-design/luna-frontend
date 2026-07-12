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
