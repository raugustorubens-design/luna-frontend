import type { KnownForgeProject } from "./memory";

export interface KnownRepo {
  owner: string;
  repo: string;
}

/**
 * Repos the Forge Git panel knows how to point at. Not a general GitHub
 * lookup (no API call) — just the small, hand-verified set of repos that
 * make up the LUNA ecosystem, used to (a) suggest a sensible default and
 * (b) flag when the owner/repo fields hold something else entirely. See
 * `git-panel.tsx`'s `useRepoTarget` for how this is used.
 */
export const KNOWN_LUNA_REPOS: KnownRepo[] = [
  { owner: "raugustorubens-design", repo: "luna-frontend" },
  { owner: "raugustorubens-design", repo: "luna" },
];

/** Default repo suggested for each Forge project — only "LUNA" has a known one today. */
const PROJECT_DEFAULT_REPO: Partial<Record<KnownForgeProject, KnownRepo>> = {
  // The repo Forge itself runs in and pushes to (see `lib/forge/git.ts`) —
  // the sensible default for the project that *is* this codebase.
  LUNA: { owner: "raugustorubens-design", repo: "luna-frontend" },
};

export function defaultRepoForProject(project: string): KnownRepo {
  return PROJECT_DEFAULT_REPO[project as KnownForgeProject] ?? KNOWN_LUNA_REPOS[0];
}

export function isKnownRepo(owner: string, repo: string): boolean {
  const normalizedOwner = owner.trim().toLowerCase();
  const normalizedRepo = repo.trim().toLowerCase();
  return KNOWN_LUNA_REPOS.some((known) => known.owner.toLowerCase() === normalizedOwner && known.repo.toLowerCase() === normalizedRepo);
}
