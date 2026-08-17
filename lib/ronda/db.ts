/**
 * Fila offline (ADR-021 Fase 1): "cada achado preenchido fica salvo
 * localmente antes de qualquer tentativa de envio" — na prática, a ronda
 * inteira (não achado a achado; o wizard já mantém o rascunho em memória
 * React até o usuário concluir) é gravada em IndexedDB assim que o usuário
 * conclui, e só depois disso o envio é tentado. Se a rede falhar, o
 * registro já está salvo — não se perde nada.
 *
 * IndexedDB nativo, sem lib (`idb` não é dependência deste projeto hoje) —
 * a superfície usada aqui é pequena o bastante (dois stores, chave simples)
 * para não justificar uma dependência nova só para isto.
 */
import type { RondaSubmission, RondaMetadata, RondaFinding, RondaClosing, SuggestionRecord, ValidationIssue } from "./types";

const DB_NAME = "luna-ronda";
const DB_VERSION = 4;
const STORE = "queue";
/**
 * Rascunho da ronda em andamento (achado de campo, 16/08/2026): até aqui o
 * wizard mantinha tudo só em memória React e só gravava algo em IndexedDB
 * na conclusão — qualquer recarga da aba apagava a ronda inteira. E recarga
 * não é hipótese remota em campo: o iOS descarta a aba de um PWA sob
 * pressão de memória com facilidade, e abrir a câmera é justamente o
 * momento de maior pressão. O rascunho é gravado continuamente aqui, com
 * foto e tudo (por isso IndexedDB e não localStorage: as fotos são base64 e
 * estouram a cota de ~5MB), e apagado na conclusão. Uma ronda em andamento
 * por vez — chave fixa `current`.
 */
const DRAFT_STORE = "draft";
const DRAFT_KEY = "current";
/**
 * Foto original de campo, preservada localmente (Decisão 4 da revisão de
 * arquitetura — `Luna-context.md`, `GENESIS/RESEARCH/
 * revisao-arquitetura-achado-dinamico-flags-foto.md`): a versão comprimida
 * (1280px/0.7, `lib/ronda/photo.ts`) é a única coisa que entra em `fotos[]`
 * e é enviada pela fila; o arquivo original fica aqui, associado ao achado
 * por `achadoId`, pra uma futura "versão de apresentação" (Fase 2) poder
 * trabalhar com qualidade melhor que o teto de 1280px da compressão de
 * campo.
 *
 * Duas correções de 16/08/2026, depois de medir o custo real (relato de
 * campo: "reduzir espaço no dispositivo"):
 *
 * 1. Guardado como `Blob`, não mais como string base64. IndexedDB aceita
 *    `Blob` via structured clone; base64 só é necessário no *fio*, na hora
 *    de enviar. A conversão custava +33% de disco em cima de um arquivo que
 *    já é o maior do sistema.
 * 2. Apagado quando a ronda é confirmada no servidor
 *    (`discardRondaLocalCopies`). Antes nada apagava nunca: medido, cada
 *    foto deixava ~9,3 MB de original permanente contra 0,13 MB da versão
 *    que o relatório de fato usa — 98,6% do que o app gravava era dado que
 *    nenhuma linha de código lia (`getOriginalPhotosForFinding` não tinha um
 *    único chamador).
 *
 * Enquanto a Camada 2 (upload por foto, que leva a original pro servidor
 * assim que ela é tirada) não existir, "apagar ao confirmar" é o
 * comportamento certo: a original acompanha a ronda enquanto ela ainda pode
 * precisar ser reenviada, e sai junto quando o servidor confirma.
 */
const ORIGINAL_PHOTOS_STORE = "originalPhotos";
/**
 * Resumo das rondas já confirmadas — mesmo formato de `GET /convergia/ronda`.
 *
 * Existe porque a alternativa a manter o item inteiro na fila para sempre
 * (com todas as fotos, ~2,7 a 5,1 MB por ronda, indefinidamente) não pode
 * ser "esquecer que a ronda existiu": sem rede, a lista de rondas
 * anteriores ficaria vazia. Guardar ~1 KB de resumo por ronda dá o mesmo
 * histórico offline por um milésimo do espaço.
 */
const HISTORY_STORE = "history";

/**
 * "invalid" (distinto de "error"): o servidor rejeitou o envio por
 * validação estrutural/semântica (HTTP 422) — não uma falha de rede. Um
 * item nesse estado nunca vai ter sucesso só de tentar de novo (o payload
 * em si está desatualizado ou incompleto), então `trySyncPendingRondas` não
 * o reenvia automaticamente; fica só como sinal pro usuário refazer a ronda
 * e descartar o item (achado real: itens antigos, de antes da migração pra
 * achado dinâmico, presos na fila local e reenviados pra sempre contra o
 * schema atual — ver BUILDER.md).
 */
export type QueueStatus = "pending" | "syncing" | "synced" | "error" | "invalid";

export interface QueueItem {
  localId: string;
  submission: RondaSubmission;
  status: QueueStatus;
  createdAt: string;
  syncedAt?: string;
  serverRondaId?: string;
  lastError?: string;
  /**
   * `issues` do 422 que moveu este item pra `"invalid"` (ver `RondaSubmitError.issues`,
   * `lib/ronda/api-client.ts`) — campo novo no registro existente, não um
   * store novo (achado de campo, 17/08/2026: o gate do cliente divergia do
   * servidor, e a tela de edição não tinha como apontar qual campo faltava).
   * Migração aditiva: um item gravado antes desta mudança simplesmente não
   * tem `issues` — `isRecoverableRejection(undefined)` trata isso como não
   * recuperável, mesmo caminho de mensagem genérica que já existia.
   */
  issues?: ValidationIssue[];
  attempts: number;
}

export interface OriginalPhotoRecord {
  /** Chave primária — `${achadoId}:${index}`, mesmo índice de `finding.fotos[]`. */
  id: string;
  achadoId: string;
  index: number;
  /** O arquivo como veio da câmera. `Blob` e não base64: o IndexedDB guarda binário nativamente, e a conversão só faz sentido no fio (ver nota em `ORIGINAL_PHOTOS_STORE`). */
  blob: Blob;
  mimeType: string;
  /** Tamanho do arquivo original em bytes — visibilidade real de quanto da cota do IndexedDB está sendo gasta. */
  sizeBytes: number;
  savedAt: string;
}

/** Resumo de uma ronda confirmada, guardado localmente pra lista funcionar offline. Mesmo formato de `RondaSubmitResult` do api-client, redeclarado aqui pra `db.ts` não depender da camada de rede. */
export interface HistoryEntry {
  rondaId: string;
  titulo: string;
  data: string;
  local: string;
  achadosCount: number;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
      if (!db.objectStoreNames.contains(ORIGINAL_PHOTOS_STORE)) {
        const originalPhotos = db.createObjectStore(ORIGINAL_PHOTOS_STORE, { keyPath: "id" });
        originalPhotos.createIndex("achadoId", "achadoId", { unique: false });
      }
      // Sem `keyPath` — o rascunho é um registro único, endereçado pela
      // chave externa fixa `DRAFT_KEY`, não por um campo de dentro dele.
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE);
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: "rondaId" });
      }
      // v4: as originais deixaram de ser base64 e passaram a ser `Blob`. Os
      // registros antigos são descartados no lugar de convertidos, e isso é
      // seguro de afirmar: o store nunca teve um leitor
      // (`getOriginalPhotosForFinding` não era chamada em lugar nenhum), então
      // nenhum recurso do app perde nada. Na prática esta linha é o que
      // devolve, de uma vez, os ~9 MB por foto que se acumularam desde o
      // início no aparelho de quem já usou o app em campo.
      if (event.oldVersion > 0 && event.oldVersion < 4 && db.objectStoreNames.contains(ORIGINAL_PHOTOS_STORE)) {
        request.transaction?.objectStore(ORIGINAL_PHOTOS_STORE).clear();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o banco local (IndexedDB) da Ronda."));
  });
}

function runTransaction<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Falha na operação local (IndexedDB) da Ronda."));
        tx.oncomplete = () => db.close();
      }),
  );
}

function newLocalId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function enqueueRonda(submission: RondaSubmission): Promise<QueueItem> {
  const item: QueueItem = {
    localId: newLocalId(),
    submission,
    status: "pending",
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await runTransaction(STORE, "readwrite", (store) => store.add(item));
  return item;
}

export async function listQueue(): Promise<QueueItem[]> {
  const items = await runTransaction<QueueItem[]>(STORE, "readonly", (store) => store.getAll());
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateQueueItem(localId: string, patch: Partial<QueueItem>): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getRequest = store.get(localId);
    getRequest.onsuccess = () => {
      const existing = getRequest.result as QueueItem | undefined;
      if (!existing) {
        resolve();
        return;
      }
      store.put({ ...existing, ...patch });
    };
    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export interface QueueCounts {
  pending: number;
  syncing: number;
  synced: number;
  error: number;
  invalid: number;
}

export function summarizeQueue(items: QueueItem[]): QueueCounts {
  return {
    pending: items.filter((i) => i.status === "pending").length,
    syncing: items.filter((i) => i.status === "syncing").length,
    synced: items.filter((i) => i.status === "synced").length,
    error: items.filter((i) => i.status === "error").length,
    invalid: items.filter((i) => i.status === "invalid").length,
  };
}

/** Remove um item da fila local — usado pra descartar itens "invalid" que o usuário já refez manualmente (não há reenvio automático possível pra eles). */
export async function deleteQueueItem(localId: string): Promise<void> {
  await runTransaction(STORE, "readwrite", (store) => store.delete(localId));
}

/** Um item da fila pelo `localId`, ou `null` — usado pela tela de edição de ronda que ainda não subiu (`/ronda/fila/[localId]`). */
export async function getQueueItem(localId: string): Promise<QueueItem | null> {
  const item = await runTransaction<QueueItem | undefined>(STORE, "readonly", (store) => store.get(localId));
  return item ?? null;
}

/**
 * Substitui a ronda de um item da fila e o devolve para `pending`.
 *
 * Diferente de `PATCH /convergia/ronda/:id`, que faz upsert por `id` de
 * achado e por isso não sabe remover nada: aqui o registro é local e
 * inteiro, então a lista de achados é substituída de verdade — remover um
 * achado nesta tela funciona, e é a única tela onde funciona.
 *
 * Voltar para `pending` é o ponto do método: editar um item que o servidor
 * rejeitou (`invalid`) só tem sentido se a edição o recolocar na fila de
 * reenvio. `lastError`/`issues` são limpos junto — descreviam o payload
 * antigo, mantê-los faria a tela acusar um problema que a edição pode ter
 * resolvido.
 */
export async function updateQueueSubmission(localId: string, submission: RondaSubmission): Promise<void> {
  await updateQueueItem(localId, { submission, status: "pending", lastError: undefined, issues: undefined });
}

/**
 * Preserva o arquivo original (sem a compressão de campo) associado a um
 * achado — chamado a partir de `FindingCard`, além (não em vez) da versão
 * comprimida que vai pra `finding.fotos[]`/fila offline. Puramente local,
 * nunca envolve rede.
 *
 * Nunca lança. Guardar a original é um "seria bom ter" (Decisão 4) e o
 * arquivo é, de longe, o maior do sistema — é justamente ele que estoura a
 * cota primeiro. Se estourar, o certo é o app seguir com a versão
 * comprimida, que é a que o relatório usa, em vez de interromper o
 * preenchimento em campo por causa de um arquivo de reserva.
 */
export async function saveOriginalPhoto(achadoId: string, index: number, file: File): Promise<OriginalPhotoRecord | null> {
  const record: OriginalPhotoRecord = {
    id: `${achadoId}:${index}`,
    achadoId,
    index,
    blob: file,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    savedAt: new Date().toISOString(),
  };
  try {
    await runTransaction(ORIGINAL_PHOTOS_STORE, "readwrite", (store) => store.put(record));
    return record;
  } catch (error) {
    console.warn("[ronda] não foi possível guardar a foto original (a versão comprimida da ronda não é afetada)", error);
    return null;
  }
}

/** Apaga uma original específica — chamada quando ela já chegou ao servidor pelo upload por foto (Camada 2). */
export async function deleteOriginalPhoto(id: string): Promise<void> {
  try {
    await runTransaction(ORIGINAL_PHOTOS_STORE, "readwrite", (store) => store.delete(id));
  } catch (error) {
    console.warn("[ronda] falha ao apagar uma foto original já enviada", error);
  }
}

export async function getOriginalPhotosForFinding(achadoId: string): Promise<OriginalPhotoRecord[]> {
  const all = await runTransaction<OriginalPhotoRecord[]>(ORIGINAL_PHOTOS_STORE, "readonly", (store) => store.getAll());
  return all.filter((record) => record.achadoId === achadoId).sort((a, b) => a.index - b.index);
}

/**
 * Libera tudo que uma ronda ocupava localmente depois de o servidor
 * confirmá-la: o item da fila (com as fotos comprimidas embutidas) e as
 * originais de todos os seus achados. No lugar fica só o resumo em
 * `HISTORY_STORE`.
 *
 * É este método que corta o acúmulo permanente. Antes, uma ronda confirmada
 * continuava inteira no aparelho para sempre — nada no código apagava
 * item de fila sincronizado nem foto original, em nenhuma circunstância.
 *
 * Nunca lança: se a limpeza falhar, a ronda já está a salvo no servidor e
 * derrubar o fluxo de sincronização por causa de uma faxina seria trocar um
 * problema de espaço por um de confiabilidade.
 */
export async function discardRondaLocalCopies(item: QueueItem, summary: HistoryEntry): Promise<void> {
  try {
    await runTransaction(HISTORY_STORE, "readwrite", (store) => store.put(summary));
    const originals = await runTransaction<OriginalPhotoRecord[]>(ORIGINAL_PHOTOS_STORE, "readonly", (store) => store.getAll());
    const achadoIds = new Set(item.submission.achados.map((finding) => finding.id));
    for (const original of originals) {
      if (achadoIds.has(original.achadoId)) {
        await runTransaction(ORIGINAL_PHOTOS_STORE, "readwrite", (store) => store.delete(original.id));
      }
    }
    await deleteQueueItem(item.localId);
  } catch (error) {
    console.warn("[ronda] falha ao liberar as cópias locais de uma ronda já confirmada", error);
  }
}

/** Resumos das rondas já confirmadas, mais recentes primeiro — é o que mantém "Ver rondas anteriores" útil sem rede. */
export async function listHistory(): Promise<HistoryEntry[]> {
  try {
    const all = await runTransaction<HistoryEntry[]>(HISTORY_STORE, "readonly", (store) => store.getAll());
    return all.sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.warn("[ronda] falha ao ler o histórico local", error);
    return [];
  }
}

/** Reidrata o cache local com o que o servidor devolveu — mantém o histórico offline em dia sem depender de a ronda ter sido enviada por este aparelho. */
export async function cacheHistory(entries: HistoryEntry[]): Promise<void> {
  try {
    for (const entry of entries) {
      await runTransaction(HISTORY_STORE, "readwrite", (store) => store.put(entry));
    }
  } catch (error) {
    console.warn("[ronda] falha ao atualizar o cache de histórico", error);
  }
}

/**
 * Estado do wizard suficiente pra remontar a tela exatamente onde a pessoa
 * parou. `checkedFlags` vira array porque `Set` não sobrevive ao
 * structured clone do IndexedDB de forma útil pro resto do código; as
 * sugestões carregadas por flag (`suggestionsByFlag`) ficam de fora de
 * propósito — são cache de rede, rebuscáveis, não dado do usuário.
 */
export interface RondaDraft {
  step: string;
  metadata: RondaMetadata;
  findings: RondaFinding[];
  closing: RondaClosing;
  checkedFlags: string[];
  suggestionOrigins: Record<string, SuggestionRecord>;
  updatedAt: string;
}

/**
 * Grava o rascunho da ronda em andamento. Nunca lança: perder o rascunho é
 * ruim, mas derrubar o preenchimento em campo por causa de uma cota cheia
 * de IndexedDB seria pior — a falha é registrada e o wizard segue com o
 * estado em memória, que é o mesmo comportamento que existia antes.
 */
export async function saveDraft(draft: Omit<RondaDraft, "updatedAt">): Promise<void> {
  const record: RondaDraft = { ...draft, updatedAt: new Date().toISOString() };
  try {
    await runTransaction(DRAFT_STORE, "readwrite", (store) => store.put(record, DRAFT_KEY));
  } catch (error) {
    console.warn("[ronda] falha ao salvar o rascunho local", error);
  }
}

/** Lê o rascunho da ronda em andamento, ou `null` se não houver (ou se a leitura falhar — nunca lança, mesmo motivo de `saveDraft`). */
export async function loadDraft(): Promise<RondaDraft | null> {
  try {
    const record = await runTransaction<RondaDraft | undefined>(DRAFT_STORE, "readonly", (store) => store.get(DRAFT_KEY));
    return record ?? null;
  } catch (error) {
    console.warn("[ronda] falha ao ler o rascunho local", error);
    return null;
  }
}

/** Apaga o rascunho — chamado quando a ronda é concluída (já virou item de fila) ou descartada explicitamente pelo usuário. */
export async function clearDraft(): Promise<void> {
  try {
    await runTransaction(DRAFT_STORE, "readwrite", (store) => store.delete(DRAFT_KEY));
  } catch (error) {
    console.warn("[ronda] falha ao apagar o rascunho local", error);
  }
}
