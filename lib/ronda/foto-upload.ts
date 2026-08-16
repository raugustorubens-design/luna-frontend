/**
 * Promoção das fotos que ficaram no aparelho — Camada 2 do ADR-021 (decisão
 * de campo, 16/08/2026).
 *
 * O caminho normal é a foto subir sozinha no momento em que é tirada
 * (`FindingCard`), e o relatório carregar só o id. Sem rede naquele
 * instante, ela cai no caminho de contingência: bytes em `fotos[]` e a
 * original guardada localmente. Este módulo é a segunda chance — roda ao
 * concluir a ronda e tenta subir o que ficou para trás.
 *
 * Cada foto promovida sai do payload do relatório e sai do aparelho. Isso
 * importa por dois motivos concretos e medidos:
 *
 *  - o `POST /convergia/ronda` tem teto de 25 MB, e uma ronda com muitas
 *    fotos embutidas chega perto dele;
 *  - a original (~9,3 MB em base64 por foto de 12MP) só alcança o servidor
 *    por aqui — pelo relatório ela nunca coube.
 *
 * Falha não é erro: a foto simplesmente continua embutida e a ronda é
 * enviada como sempre foi. Nunca lança, porque nada aqui pode impedir uma
 * ronda de ser concluída em campo.
 */
import { uploadFoto } from "./api-client";
import { getOriginalPhotosForFinding, deleteOriginalPhoto } from "./db";
import type { RondaFinding, RondaPhoto } from "./types";

/** `RondaPhoto` guarda base64 sem o prefixo `data:`; o upload quer binário. */
export function photoToBlob(photo: RondaPhoto): Blob {
  const binary = atob(photo.dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: photo.mimeType });
}

/** Quantas fotos de uma ronda ainda estão embutidas no payload — usado para decidir se vale tentar a promoção antes de concluir. */
export function countEmbeddedPhotos(findings: RondaFinding[]): number {
  return findings.reduce((total, finding) => total + (finding.fotos?.length ?? 0), 0);
}

/**
 * Tenta subir as fotos embutidas de um achado. Devolve o achado com as que
 * subiram convertidas em `fotoIds` e só as que falharam ainda em `fotos`.
 *
 * A original correspondente vai junto quando existe localmente — é o único
 * momento em que ela chega ao servidor. `getOriginalPhotosForFinding` passa
 * a ter, aqui, o primeiro chamador de sua existência: até esta camada, o
 * store de originais era gravado e nunca lido.
 */
async function promoteFinding(finding: RondaFinding): Promise<RondaFinding> {
  const embedded = finding.fotos ?? [];
  if (embedded.length === 0) return finding;

  const originals = await getOriginalPhotosForFinding(finding.id).catch(() => []);
  const promotedIds: string[] = [];
  const stillEmbedded: RondaPhoto[] = [];

  for (const [index, photo] of embedded.entries()) {
    const original = originals.find((record) => record.index === index);
    try {
      const { fotoId } = await uploadFoto(photoToBlob(photo), original?.blob, finding.id);
      promotedIds.push(fotoId);
      // A original já está no servidor; a cópia local perdeu a razão de
      // existir e é o maior arquivo do aparelho.
      if (original) await deleteOriginalPhoto(original.id);
    } catch {
      stillEmbedded.push(photo);
    }
  }

  if (promotedIds.length === 0) return finding;

  return {
    ...finding,
    fotoIds: [...(finding.fotoIds ?? []), ...promotedIds],
    // `fotos` some do achado quando esvazia — um array vazio no payload é
    // ruído, e o backend trata ausente e vazio igual.
    ...(stillEmbedded.length > 0 ? { fotos: stillEmbedded } : { fotos: undefined }),
  };
}

/**
 * Última tentativa antes de a ronda entrar na fila. Sequencial de propósito:
 * em rede de campo, disparar N uploads de vários MB em paralelo piora o
 * tempo total e a chance de sucesso — mesmo princípio do envio um-a-um em
 * `trySyncPendingRondas`.
 */
export async function promoteEmbeddedPhotos(findings: RondaFinding[]): Promise<RondaFinding[]> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return findings;

  const promoted: RondaFinding[] = [];
  for (const finding of findings) {
    try {
      promoted.push(await promoteFinding(finding));
    } catch {
      promoted.push(finding);
    }
  }
  return promoted;
}
