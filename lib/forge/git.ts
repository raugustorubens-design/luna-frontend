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

/**
 * Botões de escrita do Git panel (Forge MVP-06). Rodam `git` real no
 * checkout local do servidor (mesmo diretório de `readLocalGitStatus`,
 * `FORGE_WORKING_DIRECTORY` ?? `process.cwd()`) — nunca via GitHub API
 * (diferente de `github.list_branches`/`commits`/`pull_requests` no
 * Gateway, que são leituras remotas). Toda a autenticação com o GitHub
 * remoto (push/pull) usa a identidade git já configurada no ambiente do
 * servidor (credencial de serviço do Builder) — não existe, e não deve
 * existir, nenhum caminho aqui que leve a credencial de um agente de chat
 * específico (GPT/Claude/Groq) a influenciar commit/push/pull/branch. O
 * seletor de agente do Chat (Forge MVP-02) é inteiramente irrelevante para
 * este arquivo.
 */

function friendlyGitError(err: unknown, fallback: string): Error {
  const stderr = err && typeof err === "object" && "stderr" in err ? String((err as { stderr: unknown }).stderr).trim() : "";
  return new Error(stderr || fallback);
}

export interface CommitResult {
  committed: boolean;
  sha: string | null;
  message: string;
}

/** `git add -A && git commit -m <message>`. `committed: false` (não erro) quando não havia nada para commitar. */
export async function commitAllLocalChanges(cwd: string, message: string): Promise<CommitResult> {
  await execFileAsync("git", ["add", "-A"], { cwd });
  try {
    await execFileAsync("git", ["commit", "-m", message], { cwd });
  } catch (err) {
    const stdout = err && typeof err === "object" && "stdout" in err ? String((err as { stdout: unknown }).stdout) : "";
    if (/nothing to commit/i.test(stdout)) {
      return { committed: false, sha: null, message: "Nada para commitar — árvore de trabalho limpa." };
    }
    throw friendlyGitError(err, "Falha ao commitar.");
  }
  const status = await readLocalGitStatus(cwd);
  return { committed: true, sha: status.lastCommit?.sha ?? null, message: status.lastCommit?.message ?? message };
}

export interface PushResult {
  branch: string;
  output: string;
}

/** `git push -u origin <branch atual>` — funciona tanto para branch já rastreada quanto para o primeiro push. */
export async function pushCurrentBranch(cwd: string): Promise<PushResult> {
  const status = await readLocalGitStatus(cwd);
  try {
    const result = await execFileAsync("git", ["push", "-u", "origin", status.branch], { cwd });
    return { branch: status.branch, output: (result.stdout + result.stderr).trim() };
  } catch (err) {
    throw friendlyGitError(err, "Falha ao dar push.");
  }
}

export interface PullResult {
  branch: string;
  output: string;
}

/** `git pull` na branch atual. */
export async function pullCurrentBranch(cwd: string): Promise<PullResult> {
  const status = await readLocalGitStatus(cwd);
  try {
    const result = await execFileAsync("git", ["pull"], { cwd });
    return { branch: status.branch, output: (result.stdout + result.stderr).trim() };
  } catch (err) {
    throw friendlyGitError(err, "Falha ao dar pull.");
  }
}

const VALID_BRANCH_NAME = /^[A-Za-z0-9._/-]+$/;

/** `git checkout -b <name>` — cria e troca para uma branch nova a partir do HEAD atual. */
export async function createLocalBranch(cwd: string, name: string): Promise<LocalGitStatus> {
  const trimmed = name.trim();
  if (!trimmed || !VALID_BRANCH_NAME.test(trimmed)) {
    throw new Error("Nome de branch inválido — use apenas letras, números, '.', '_', '-' e '/'.");
  }
  try {
    await execFileAsync("git", ["checkout", "-b", trimmed], { cwd });
  } catch (err) {
    throw friendlyGitError(err, "Falha ao criar branch.");
  }
  return readLocalGitStatus(cwd);
}
