"use client";

// ADR-022, Forge v2 — leitura de `GET /api/forge/git-status` (dado real, já
// existente, usado por `context-panel.tsx`) para o segmento de branch da
// StatusBar. Hook próprio em vez de duplicar o fetch em cada consumidor.
import { useEffect, useState } from "react";
import type { LocalGitStatus } from "@/lib/forge/git";

type GitStatusState =
  | { status: "loading" }
  | { status: "ready"; data: LocalGitStatus }
  | { status: "error" };

export function useGitStatus(): GitStatusState {
  const [state, setState] = useState<GitStatusState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/forge/git-status")
      .then((res) => {
        if (!res.ok) throw new Error(`git-status respondeu ${res.status}`);
        return res.json();
      })
      .then((data: LocalGitStatus) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
