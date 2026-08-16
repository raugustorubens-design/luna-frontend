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
import type { RondaSubmission, RondaMetadata, RondaFinding, RondaClosing, SuggestionRecord } from "./types";

const DB_NAME = "luna-ronda";
const DB_VERSION = 3;
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
 * e é enviada pela fila; o arquivo original, maior/melhor qualidade, fica só
 * aqui, associado ao achado por `achadoId`, pra uma futura "versão de
 * apresentação" (Fase 2) poder trabalhar com qualidade melhor que o teto de
 * 1280px que a compressão de campo já impõe. Nada aqui é enviado ao
 * servidor nesta rodada — só preservado.
 */
const ORIGINAL_PHOTOS_STORE = "originalPhotos";

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
  attempts: number;
}

export interface OriginalPhotoRecord {
  /** Chave primária — `${achadoId}:${index}`, mesmo índice de `finding.fotos[]`. */
  id: string;
  achadoId: string;
  index: number;
  dataBase64: string;
  mimeType: string;
  /** Tamanho do arquivo original em bytes, sem base64 — visibilidade real de quanto a cota do IndexedDB está sendo gasta (fotos originais são bem maiores que a versão de campo comprimida). */
  sizeBytes: number;
  savedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler a foto original."));
    reader.readAsDataURL(file);
  });
}

/**
 * Preserva o arquivo original (sem a compressão de campo) associado a um
 * achado — chamado a partir de `FindingCard`, além (não em vez) da versão
 * comprimida que vai pra `finding.fotos[]`/fila offline. Nunca lançado
 * envolvendo rede — puramente local.
 */
export async function saveOriginalPhoto(achadoId: string, index: number, file: File): Promise<OriginalPhotoRecord> {
  const dataBase64 = await fileToBase64(file);
  const record: OriginalPhotoRecord = {
    id: `${achadoId}:${index}`,
    achadoId,
    index,
    dataBase64,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    savedAt: new Date().toISOString(),
  };
  await runTransaction(ORIGINAL_PHOTOS_STORE, "readwrite", (store) => store.put(record));
  return record;
}

export async function getOriginalPhotosForFinding(achadoId: string): Promise<OriginalPhotoRecord[]> {
  const all = await runTransaction<OriginalPhotoRecord[]>(ORIGINAL_PHOTOS_STORE, "readonly", (store) => store.getAll());
  return all.filter((record) => record.achadoId === achadoId).sort((a, b) => a.index - b.index);
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
