import assert from "node:assert/strict";
import test from "node:test";
import { countEmbeddedPhotos, photoToBlob } from "../foto-upload";
import type { RondaFinding } from "../types";

function achado(id: string, fotos: number, fotoIds: string[] = []): RondaFinding {
  return {
    id,
    estado: "identificado",
    ...(fotos > 0 ? { fotos: Array.from({ length: fotos }, () => ({ dataBase64: "AQID", mimeType: "image/jpeg" as const })) } : {}),
    ...(fotoIds.length > 0 ? { fotoIds } : {}),
  };
}

/**
 * Camada 2: só a foto que **não** conseguiu subir na hora continua embutida
 * no relatório. A contagem é o que decide se vale tentar a promoção antes de
 * concluir — e é a medida direta de quanto payload ainda depende do teto de
 * 25 MB do `POST /convergia/ronda`.
 */
test("countEmbeddedPhotos conta só o que ainda viaja dentro do relatório", () => {
  assert.equal(countEmbeddedPhotos([achado("a", 2), achado("b", 0, ["rfoto_1"]), achado("c", 1, ["rfoto_2"])]), 3);
});

test("achado que já subiu tudo não pesa no payload", () => {
  assert.equal(countEmbeddedPhotos([achado("a", 0, ["rfoto_1", "rfoto_2"])]), 0);
  assert.equal(countEmbeddedPhotos([]), 0);
});

/** O upload é binário (multipart); base64 é só o formato de contingência guardado no aparelho. A conversão precisa devolver exatamente os mesmos bytes. */
test("photoToBlob devolve os bytes originais, sem o inchaço do base64", async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x10, 0x7f]);
  const dataBase64 = Buffer.from(bytes).toString("base64");
  const blob = photoToBlob({ dataBase64, mimeType: "image/jpeg" });

  assert.equal(blob.type, "image/jpeg");
  assert.equal(blob.size, bytes.length, "o binário tem que ser menor que a string base64");
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});
