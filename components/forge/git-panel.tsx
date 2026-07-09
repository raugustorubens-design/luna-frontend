"use client";

// Portado de forge/apps/web/src/components/git-panel/GitPanel.tsx (monorepo `luna`).
import { useState } from "react";
import { GitBranch, GitCommit, GitPullRequest, Merge, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  listGithubBranches,
  listGithubCommits,
  listGithubPullRequests,
  compareGithubCommits,
  type GithubBranchSummary,
  type GithubCommitSummary,
  type GithubPullRequestSummary,
  type GithubCompareResult,
} from "@/lib/forge/api-client";

function useRepoTarget() {
  const [owner, setOwner] = useState(() => (typeof window === "undefined" ? "raugustorubens-design" : localStorage.getItem("forge.github.owner") ?? "raugustorubens-design"));
  const [repo, setRepo] = useState(() => (typeof window === "undefined" ? "luna" : localStorage.getItem("forge.github.repo") ?? "luna"));

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
  const [branches, setBranches] = useState<GithubBranchSummary[] | null>(null);
  const [commits, setCommits] = useState<GithubCommitSummary[] | null>(null);
  const [pullRequests, setPullRequests] = useState<GithubPullRequestSummary[] | null>(null);
  const [diff, setDiff] = useState<GithubCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          defaultValue={owner}
          onBlur={(event) => save(event.target.value, repo)}
          className="w-28 rounded border border-border bg-transparent px-1.5 py-0.5 text-xs"
          placeholder="owner"
        />
        <span className="text-xs text-muted-foreground">/</span>
        <input
          defaultValue={repo}
          onBlur={(event) => save(owner, event.target.value)}
          className="w-24 rounded border border-border bg-transparent px-1.5 py-0.5 text-xs"
          placeholder="repo"
        />
        <Button size="icon" variant="ghost" onClick={refresh} disabled={loading} title="Atualizar via Gateway">
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        </Button>
      </div>

      {error && <div className="border-b px-3 py-1.5 text-xs text-destructive">{error}</div>}

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
