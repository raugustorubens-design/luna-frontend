/**
 * Fila offline (ADR-021 Fase 1): "cada achado preenchido fica salvo
 * localmente antes de qualquer tentativa de envio" — na prática, a ronda
 * inteira (não achado a achado; o wizard já mantém o rascunho em memória
 * React até o usuário concluir) é gravada em IndexedDB assim que o usuário
 * conclui, e só depois disso o envio é tentado. Se a rede falhar, o
 * registro já está salvo — não se perde nada.
 *
 * IndexedDB nativo, sem lib (`idb` não é dependência deste projeto hoje) —
 * a superfície usada aqui é pequena o bastante (um store, chave simples)
 * para não justificar uma dependência nova só para isto.
 */
import type { RondaSubmission } from "./types";

const DB_NAME = "luna-ronda";
const DB_VERSION = 1;
const STORE = "queue";

export type QueueStatus = "pending" | "syncing" | "synced" | "error";

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o banco local (IndexedDB) da Ronda."));
  });
}

function runTransaction<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
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
  await runTransaction("readwrite", (store) => store.add(item));
  return item;
}

export async function listQueue(): Promise<QueueItem[]> {
  const items = await runTransaction<QueueItem[]>("readonly", (store) => store.getAll());
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
}

export function summarizeQueue(items: QueueItem[]): QueueCounts {
  return {
    pending: items.filter((i) => i.status === "pending").length,
    syncing: items.filter((i) => i.status === "syncing").length,
    synced: items.filter((i) => i.status === "synced").length,
    error: items.filter((i) => i.status === "error").length,
  };
}
