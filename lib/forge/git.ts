import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface LocalGitStatus {
  branch: string;
  lastCommit: { sha: string; message: string } | null;
}

/**
 * Purely local git info (current checkout state) — not a Gateway concern.
 * `github.list_branches` returns remote branches via the GitHub API; it has
 * no notion of "what's currently checked out on this machine".
 *
 * Portado de forge/apps/server/src/git.ts (monorepo `luna`), sem alterações
 * de lógica.
 */
export async function readLocalGitStatus(cwd: string): Promise<LocalGitStatus> {
  const branch = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd })
    .then((result) => result.stdout.trim())
    .catch(() => "unknown");

  const lastCommit = await execFileAsync("git", ["log", "-1", "--format=%H%x1f%s"], { cwd })
    .then((result) => {
      const [sha, message] = result.stdout.trim().split("\x1f");
      return sha ? { sha, message: message ?? "" } : null;
    })
    .catch(() => null);

  return { branch, lastCommit };
}
