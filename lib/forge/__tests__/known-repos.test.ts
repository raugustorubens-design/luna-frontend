import assert from "node:assert/strict";
import test from "node:test";
import { KNOWN_LUNA_REPOS, defaultRepoForProject, isKnownRepo } from "../known-repos";

test("isKnownRepo accepts every repo in the known list, case-insensitively and trimmed", () => {
  for (const known of KNOWN_LUNA_REPOS) {
    assert.equal(isKnownRepo(known.owner, known.repo), true);
    assert.equal(isKnownRepo(known.owner.toUpperCase(), known.repo.toUpperCase()), true);
    assert.equal(isKnownRepo(` ${known.owner} `, ` ${known.repo} `), true);
  }
});

test("isKnownRepo rejects an owner/repo pair outside the known list", () => {
  assert.equal(isKnownRepo("someone-else", "luna-frontend"), false);
  assert.equal(isKnownRepo("raugustorubens-design", "unrelated-repo"), false);
  assert.equal(isKnownRepo("", ""), false);
});

test("defaultRepoForProject suggests luna-frontend for the LUNA project", () => {
  assert.deepEqual(defaultRepoForProject("LUNA"), { owner: "raugustorubens-design", repo: "luna-frontend" });
});

test("defaultRepoForProject falls back to the first known repo for a project without a mapping", () => {
  assert.deepEqual(defaultRepoForProject("RENASCER"), KNOWN_LUNA_REPOS[0]);
  assert.deepEqual(defaultRepoForProject("some unknown project"), KNOWN_LUNA_REPOS[0]);
});
