import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readLocalGitStatus } from "../git";

const execFileAsync = promisify(execFile);

test("readLocalGitStatus reports the current branch and last commit of a real repo", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "forge-git-"));
  try {
    await execFileAsync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: dir });
    await execFileAsync("git", ["commit", "--allow-empty", "-q", "-m", "initial commit"], { cwd: dir });

    const status = await readLocalGitStatus(dir);

    assert.equal(status.branch, "main");
    assert.equal(status.lastCommit?.message, "initial commit");
    assert.match(status.lastCommit?.sha ?? "", /^[0-9a-f]{40}$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readLocalGitStatus degrades gracefully outside a git repository", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "forge-not-git-"));
  try {
    const status = await readLocalGitStatus(dir);
    assert.equal(status.branch, "unknown");
    assert.equal(status.lastCommit, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
