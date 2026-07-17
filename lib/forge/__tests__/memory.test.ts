import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryItem } from "../memory";

const executionMetadata = {
  repository: "raugustorubens-design/luna-frontend",
  branch: "claude/forge-mvp-01-08",
  path: "lib/forge/memory.ts",
  commit: "abc1234",
  owner: "Builder",
};

test("createMemoryItem fills id and saved_at when not provided", () => {
  const item = createMemoryItem({ content: "hello", project: "LUNA", execution_metadata: executionMetadata });

  assert.match(item.id, /^[0-9a-f-]{36}$/);
  assert.equal(item.content, "hello");
  assert.equal(item.project, "LUNA");
  assert.deepEqual(item.execution_metadata, executionMetadata);
  assert.doesNotThrow(() => new Date(item.saved_at).toISOString());
});

test("createMemoryItem honors an explicit id and saved_at instead of generating them", () => {
  const item = createMemoryItem({
    content: "hello",
    project: "RENASCER",
    execution_metadata: executionMetadata,
    id: "fixed-id",
    saved_at: "2026-07-17T00:00:00.000Z",
  });

  assert.equal(item.id, "fixed-id");
  assert.equal(item.saved_at, "2026-07-17T00:00:00.000Z");
});

test("createMemoryItem accepts a project outside the known list (schema is open, KNOWN_FORGE_PROJECTS is UI-only)", () => {
  const item = createMemoryItem({ content: "x", project: "NOVO-PROJETO", execution_metadata: executionMetadata });
  assert.equal(item.project, "NOVO-PROJETO");
});
