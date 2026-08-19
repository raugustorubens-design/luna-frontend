/**
 * Modelo de exibição único para "Ver rondas anteriores".
 *
 * Achado de campo em 16/08/2026: a tela listava só o que o servidor havia
 * confirmado (`GET /convergia/ronda`), e a fila local aparecia apenas como
 * *contagem* na barra de status. Uma ronda pendente, travada ou rejeitada
 * era, na prática, invisível — não dava para abrir, ver o que tinha dentro,
 * nem saber por que não subiu. Quando uma sumiu de vista em campo, não
 * havia tela nenhuma capaz de responder "cadê minha ronda".
 *
 * Aqui as duas origens viram uma lista só, cada item carregando de onde
 * veio. Função pura de propósito: é o que permite testar a fusão e a ordem
 * sem IndexedDB nem rede.
 */
import type { RondaSubmitResult } from "./api-client";
import type { HistoryEntry, QueueItem, QueueStatus } from "./db";

export type RondaListEntry =
  | {
      kind: "server";
      /** `ronda_<uuid>` — id do servidor, rota `/ronda/historico/[id]`. */
      id: string;
      titulo: string;
      data: string;
      local: string;
      achadosCount: number;
      createdAt: string;
    }
  | {
      kind: "queue";
      /** `localId` do item na fila, rota `/ronda/fila/[localId]`. */
      id: string;
      titulo: string;
      data: string;
      local: string;
      achadosCount: number;
      createdAt: string;
      status: QueueStatus;
      lastError?: string;
    };

/** Rótulo e cor por estado, para a etiqueta ao lado de cada item. `synced` só aparece quando o servidor está fora do ar (ver `buildRondaList`). */
export const ENTRY_STATUS_LABEL: Record<QueueStatus | "server", string> = {
  server: "No servidor",
  pending: "Aguardando envio",
  syncing: "Enviando…",
  synced: "Confirmada",
  error: "Falhou — vai tentar de novo",
  invalid: "Rejeitada pelo servidor",
  unauthenticated: "Sessão expirada — entre novamente",
};

/**
 * Mesma regra de contagem do backend (`ronda-store.ts`): só achado
 * `identificado` conta. Espelhado aqui para um item que ainda não subiu
 * exibir o mesmo número que vai exibir depois de subir — número que muda
 * sozinho ao sincronizar é exatamente o tipo de coisa que faz a pessoa
 * desconfiar de perda de dado.
 */
export function countIdentified(item: QueueItem): number {
  return item.submission.achados.filter((finding) => finding.estado === "identificado").length;
}

/**
 * Funde as duas origens numa lista só, mais recente primeiro.
 *
 * `server === null` significa "não deu para falar com o servidor" (offline,
 * que é o caso comum em campo) — diferente de `[]`, que é "o servidor
 * respondeu e não há nada lá". A distinção importa: com o servidor fora, a
 * lista é montada a partir do cache local de resumos (`history`), para a
 * tela nunca ficar vazia só porque não há rede. Com o servidor no ar, ele é
 * a fonte canônica e o cache é ignorado.
 *
 * O cache existe porque a ronda confirmada deixou de ficar guardada inteira
 * no aparelho (ver `discardRondaLocalCopies`) — sem ele, economizar espaço
 * teria custado o histórico offline.
 */
export function buildRondaList(server: RondaSubmitResult[] | null, queue: QueueItem[], history: HistoryEntry[] = []): RondaListEntry[] {
  const entries: RondaListEntry[] = [];

  const confirmed: HistoryEntry[] =
    server !== null
      ? server.map((ronda) => ({
          rondaId: ronda.rondaId,
          titulo: ronda.titulo,
          data: ronda.data,
          local: ronda.local,
          achadosCount: ronda.achadosCount,
          createdAt: ronda.createdAt,
        }))
      : history;

  for (const ronda of confirmed) {
    entries.push({
      kind: "server",
      id: ronda.rondaId,
      titulo: ronda.titulo,
      data: ronda.data,
      local: ronda.local,
      achadosCount: ronda.achadosCount,
      createdAt: ronda.createdAt,
    });
  }

  for (const item of queue) {
    // Item "synced" na fila só sobrevive se `discardRondaLocalCopies` falhou
    // — o caminho normal apaga. Omitido quando o registro canônico já está
    // na lista, pra não virar duplicata.
    if (item.status === "synced" && confirmed.some((ronda) => ronda.rondaId === item.serverRondaId)) continue;
    if (item.status === "synced" && server !== null) continue;
    entries.push({
      kind: "queue",
      id: item.localId,
      titulo: item.submission.metadata.titulo,
      data: item.submission.metadata.data,
      local: item.submission.metadata.local,
      achadosCount: countIdentified(item),
      createdAt: item.createdAt,
      status: item.status,
      lastError: item.lastError,
    });
  }

  // `data` é o dia da ronda (o que a pessoa procura); `createdAt` desempata
  // duas rondas do mesmo dia pela ordem em que foram registradas.
  return entries.sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt));
}
