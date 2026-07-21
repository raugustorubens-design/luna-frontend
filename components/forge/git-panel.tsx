"use client";

// Portado de forge/apps/web/src/components/git-panel/GitPanel.tsx (monorepo `luna`).
import { useState } from "react";
import { GitBranch, GitCommit, GitPullRequest, Merge, RefreshCw, Upload, Download, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/forge/utils";
import { useForgeProject } from "@/lib/forge/project-context";
import { defaultRepoForProject, isKnownRepo } from "@/lib/forge/known-repos";
import {
  listGithubBranches,
  listGithubCommits,
  listGithubPullRequests,
  compareGithubCommits,
  commitLocalChanges,
  pushLocalBranch,
  pullLocalBranch,
  createGitBranch,
  type GithubBranchSummary,
  type GithubCommitSummary,
  type GithubPullRequestSummary,
  type GithubCompareResult,
} from "@/lib/forge/api-client";

/**
 * Suggests owner/repo from the active Forge project (see `known-repos.ts`)
 * instead of a hardcoded default, and only when there's nothing saved yet —
 * a value the user already typed always wins, even an unrecognized one
 * (`isKnownRepo` below is what flags that case, not this function).
 */
function useRepoTarget() {
  const { project } = useForgeProject();
  const fallback = defaultRepoForProject(project);

  const [owner, setOwner] = useState(() => (typeof window === "undefined" ? fallback.owner : localStorage.getItem("forge.github.owner") ?? fallback.owner));
  const [repo, setRepo] = useState(() => (typeof window === "undefined" ? fallback.repo : localStorage.getItem("forge.github.repo") ?? fallback.repo));

  function save(nextOwner: string, nextRepo: string) {
    setOwner(nextOwner);
    setRepo(nextRepo);
    localStorage.setItem("forge.github.owner", nextOwner);
    localStorage.setItem("forge.github.repo", nextRepo);
  }

  return { owner, repo, save };
}

export function GitPanel() {
  const { owner, repo, save } = useRepoTarget();
  const knownRepo = isKnownRepo(owner, repo);
  const [branches, setBranches] = useState<GithubBranchSummary[] | null>(null);
  const [commits, setCommits] = useState<GithubCommitSummary[] | null>(null);
  const [pullRequests, setPullRequests] = useState<GithubPullRequestSummary[] | null>(null);
  const [diff, setDiff] = useState<GithubCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forge MVP-06 — botões de escrita (commit/push/pull/branch), sempre sob
  // a credencial de serviço do servidor (ver lib/forge/git.ts), nunca a de
  // um agente de chat. Estado separado do resto do painel (que é só
  // leitura via GitHub API/Gateway) porque estas ações mexem no checkout
  // git local, não no repositório remoto listado acima.
  const [commitMessage, setCommitMessage] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [gitActionPending, setGitActionPending] = useState<string | null>(null);
  const [gitActionFeedback, setGitActionFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  async function runGitAction(name: string, action: () => Promise<string>) {
    setGitActionPending(name);
    setGitActionFeedback(null);
    try {
      const text = await action();
      setGitActionFeedback({ ok: true, text });
    } catch (err) {
      setGitActionFeedback({ ok: false, text: err instanceof Error ? err.message : `Falha em ${name}.` });
    } finally {
      setGitActionPending(null);
    }
  }

  async function handleCommit() {
    if (!commitMessage.trim()) return;
    await runGitAction("commit", async () => {
      const result = await commitLocalChanges(commitMessage.trim());
      if (result.committed) setCommitMessage("");
      return result.committed ? `Commitado: ${result.message}` : result.message;
    });
  }

  async function handlePush() {
    await runGitAction("push", async () => {
      const result = await pushLocalBranch();
      return `Push de ${result.branch} concluído.`;
    });
  }

  async function handlePull() {
    await runGitAction("pull", async () => {
      const result = await pullLocalBranch();
      return `Pull de ${result.branch} concluído.`;
    });
  }

  async function handleCreateBranch() {
    if (!newBranchName.trim()) return;
    await runGitAction("branch", async () => {
      const status = await createGitBranch(newBranchName.trim());
      setNewBranchName("");
      return `Nova branch: ${status.branch}`;
    });
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [b, c, prs] = await Promise.all([
        listGithubBranches(owner, repo),
        listGithubCommits(owner, repo),
        listGithubPullRequests(owner, repo),
      ]);
      setBranches(b);
      setCommits(c);
      setPullRequests(prs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao consultar o GitHub via Gateway");
    } finally {
      setLoading(false);
    }
  }

  async function loadDiff(base: string, head: string) {
    try {
      setDiff(await compareGithubCommits(owner, repo, base, head));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao comparar commits");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <input
          key={owner}
          defaultValue={owner}
          onBlur={(event) => save(event.target.value, repo)}
          className={cn("w-28 rounded border bg-transparent px-1.5 py-0.5 text-xs", knownRepo ? "border-border" : "border-destructive text-destructive")}
          placeholder="owner"
          title={knownRepo ? undefined : "Repositório não reconhecido no ecossistema LUNA"}
        />
        <span className="text-xs text-muted-foreground">/</span>
        <input
          key={repo}
          defaultValue={repo}
          onBlur={(event) => save(owner, event.target.value)}
          className={cn("w-24 rounded border bg-transparent px-1.5 py-0.5 text-xs", knownRepo ? "border-border" : "border-destructive text-destructive")}
          placeholder="repo"
          title={knownRepo ? undefined : "Repositório não reconhecido no ecossistema LUNA"}
        />
        <Button size="icon" variant="ghost" onClick={refresh} disabled={loading} title="Atualizar via Gateway">
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        </Button>
      </div>

      {!knownRepo && (
        <div className="border-b px-3 py-1.5 text-xs text-destructive">
          "{owner}/{repo}" não é um repositório conhecido do ecossistema LUNA — confira antes de continuar.
        </div>
      )}

      {error && <div className="border-b px-3 py-1.5 text-xs text-destructive">{error}</div>}

      <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-1.5">
        <input
          value={commitMessage}
          onChange={(event) => setCommitMessage(event.target.value)}
          placeholder="Mensagem do commit"
          className="w-40 rounded border border-border bg-transparent px-1.5 py-0.5 text-xs"
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px]"
          onClick={handleCommit}
          disabled={gitActionPending !== null || !commitMessage.trim()}
          title="git add -A && git commit — checkout local do servidor"
        >
          <GitCommit className="mr-1 h-3 w-3" />commit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px]"
          onClick={handlePush}
          disabled={gitActionPending !== null}
          title="git push -u origin <branch atual>"
        >
          <Upload className="mr-1 h-3 w-3" />push
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px]"
          onClick={handlePull}
          disabled={gitActionPending !== null}
          title="git pull na branch atual"
        >
          <Download className="mr-1 h-3 w-3" />pull
        </Button>
        <input
          value={newBranchName}
          onChange={(event) => setNewBranchName(event.target.value)}
          placeholder="nova-branch"
          className="w-28 rounded border border-border bg-transparent px-1.5 py-0.5 text-xs"
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px]"
          onClick={handleCreateBranch}
          disabled={gitActionPending !== null || !newBranchName.trim()}
          title="git checkout -b <nome> — cria e troca localmente"
        >
          <Plus className="mr-1 h-3 w-3" />branch
        </Button>
      </div>

      {gitActionFeedback && (
        <div className={cn("border-b px-3 py-1.5 text-xs", gitActionFeedback.ok ? "text-muted-foreground" : "text-destructive")}>
          {gitActionFeedback.text}
        </div>
      )}

      <Tabs defaultValue="branches" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-2 mt-1 justify-start">
          <TabsTrigger value="branches"><GitBranch className="mr-1 h-3.5 w-3.5" />Branches</TabsTrigger>
          <TabsTrigger value="commits"><GitCommit className="mr-1 h-3.5 w-3.5" />Commits</TabsTrigger>
          <TabsTrigger value="prs"><GitPullRequest className="mr-1 h-3.5 w-3.5" />Pull Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-3">
            {branches === null && <p className="py-2 text-xs text-muted-foreground">Clique em atualizar.</p>}
            {branches?.map((branch) => (
              <div key={branch.name} className="flex items-center justify-between border-b py-1.5 text-xs">
                <span>{branch.name}</span>
                <span className="font-mono text-muted-foreground">{branch.sha.slice(0, 7)}</span>
              </div>
            ))}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="commits" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-3">
            {commits === null && <p className="py-2 text-xs text-muted-foreground">Clique em atualizar.</p>}
            {commits?.map((commit, index) => (
              <button
                key={commit.sha}
                onClick={() => index + 1 < (commits?.length ?? 0) && loadDiff(commits[index + 1]!.sha, commit.sha)}
                className="block w-full border-b py-1.5 text-left text-xs hover:bg-muted"
              >
                <div className="truncate">{commit.message}</div>
                <div className="text-muted-foreground">
                  {commit.author} · <span className="font-mono">{commit.sha.slice(0, 7)}</span>
                </div>
              </button>
            ))}
            {diff && (
              <div className="mt-2 rounded border p-2 text-xs">
                <div className="mb-1 font-semibold">{diff.totalCommits} commit(s) — {diff.aheadBy} à frente / {diff.behindBy} atrás</div>
                {diff.files.map((file) => (
                  <div key={file.filename} className="flex justify-between font-mono">
                    <span>{file.filename}</span>
                    <span className="text-muted-foreground">+{file.additions} -{file.deletions}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="prs" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-3">
            {pullRequests === null && <p className="py-2 text-xs text-muted-foreground">Clique em atualizar.</p>}
            {pullRequests?.map((pr) => (
              <div key={pr.number} className="border-b py-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="truncate">#{pr.number} {pr.title}</span>
                  <span className="text-muted-foreground">{pr.state}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  {pr.head} → {pr.base}
                  <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" disabled title="Capability github.merge_pull_request ainda não existe no Gateway — ver ROADMAP.md">
                    <Merge className="mr-1 h-3 w-3" />merge
                  </Button>
                </div>
              </div>
            ))}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
