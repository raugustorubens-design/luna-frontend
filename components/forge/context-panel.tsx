"use client";

// Forge MVP-02: este painel não lê mais o arquivo de continuidade do
// organismo (ou qualquer markdown) diretamente — todo o contexto vem do
// Context Hub via fetchOrganismContext() (`GET /api/context`). O único dado
// que continua local é branch/último commit do checkout deste próprio
// servidor (via fetchLocalGitStatus), que não é conhecimento do organismo,
// é estado da máquina de desenvolvimento.
import { Fragment, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchLocalGitStatus, fetchOrganismContext, type LocalGitStatus, type OrganismContext } from "@/lib/forge/api-client";

export function ContextPanel() {
  const [gitStatus, setGitStatus] = useState<LocalGitStatus | null>(null);
  const [context, setContext] = useState<OrganismContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocalGitStatus().then(setGitStatus).catch(() => setGitStatus(null));
    fetchOrganismContext()
      .then(setContext)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao reconstruir contexto via Context Hub"));
  }, []);

  const fields = [
    { label: "Sistema atual", value: context?.project ?? "…" },
    { label: "Órgão atual", value: "Forge" },
    { label: "MVP atual", value: context?.currentMvp || "…" },
    { label: "Branch (local)", value: gitStatus?.branch ?? "…" },
    {
      label: "Último commit (local)",
      value: gitStatus?.lastCommit ? `${gitStatus.lastCommit.sha.slice(0, 7)} — ${gitStatus.lastCommit.message}` : "…",
    },
    {
      label: "Último checkpoint (memória)",
      value: context?.checkpoints[0] ? context.checkpoints[0].summary : "nenhum disponível",
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contexto</div>
      <ScrollArea className="flex-1 px-3 pb-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {fields.map((field) => (
            <Fragment key={field.label}>
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="truncate">{field.value}</dd>
            </Fragment>
          ))}
        </dl>

        {error && (
          <div className="mt-3 border-t pt-2 text-destructive">
            {error}
          </div>
        )}

        {context && (
          <>
            <div className="mt-3 border-t pt-2">
              <div className="mb-1 text-muted-foreground">Missão atual</div>
              <p className="whitespace-pre-wrap">{context.mission}</p>
            </div>

            <div className="mt-3 border-t pt-2">
              <div className="mb-1 text-muted-foreground">Estado arquitetural</div>
              <p className="whitespace-pre-wrap">{context.architecturalState}</p>
              <p className="mt-1 text-muted-foreground">{context.organismState}</p>
            </div>

            {context.roadmap.length > 0 && (
              <div className="mt-3 border-t pt-2">
                <div className="mb-1 text-muted-foreground">Roadmap</div>
                <ul className="list-inside list-disc space-y-0.5">
                  {context.roadmap.map((item) => (
                    <li key={item} className="truncate">{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {context.inferences.length > 0 && (
              <div className="mt-3 border-t pt-2">
                <div className="mb-1 text-muted-foreground">Inferências consolidadas</div>
                <ul className="list-inside list-disc space-y-0.5">
                  {context.inferences.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {context.activeSystems.length > 0 && (
              <div className="mt-3 border-t pt-2">
                <div className="mb-1 text-muted-foreground">Sistemas ativos</div>
                <p>{context.activeSystems.join(", ")}</p>
              </div>
            )}

            {context.providers.length > 0 && (
              <div className="mt-3 border-t pt-2">
                <div className="mb-1 text-muted-foreground">Providers</div>
                <p>
                  {context.providers.map((provider) => `${provider.id}${provider.configured ? " ✓" : ""}`).join(", ")}
                </p>
              </div>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  );
}
