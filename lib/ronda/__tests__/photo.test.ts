import assert from "node:assert/strict";
import test from "node:test";
import { parseImageDimensionsFromHeader, resizeCeilingFor } from "../photo";

test("resizeCeilingFor mantém 1280px para proporções até 2.5:1", () => {
  assert.equal(resizeCeilingFor(1920, 1080), 1280); // ~1.78:1
  assert.equal(resizeCeilingFor(2500, 1000), 1280); // exatamente 2.5:1
  assert.equal(resizeCeilingFor(1000, 1000), 1280); // quadrada
});

test("resizeCeilingFor sobe para 2000px acima de 2.5:1 — panorâmica", () => {
  assert.equal(resizeCeilingFor(4000, 1000), 2000); // 4:1
  assert.equal(resizeCeilingFor(1000, 4000), 2000); // mesmo em pé
  assert.equal(resizeCeilingFor(2501, 1000), 2000); // logo acima do limiar
});

/** Cabeçalho JPEG mínimo: SOI, um APP0 qualquer, SOF0 com 100x50, SOS. */
function buildJpegHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // APP0, length 16
    0xff, 0xc0, 0x00, 0x0b, 0x08, // SOF0, length 11, precision 8
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x22, 0x00, // resto do SOF0 (componentes) — irrelevante pro parse
    0xff, 0xda, 0x00, 0x08, // SOS — sinaliza fim dos cabeçalhos
  ]);
}

function buildPngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // assinatura PNG
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8); // comprimento do chunk IHDR (13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  bytes[16] = (width >> 24) & 0xff;
  bytes[17] = (width >> 16) & 0xff;
  bytes[18] = (width >> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >> 24) & 0xff;
  bytes[21] = (height >> 16) & 0xff;
  bytes[22] = (height >> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

test("parseImageDimensionsFromHeader lê largura/altura de um JPEG válido", () => {
  const dims = parseImageDimensionsFromHeader(buildJpegHeader(1920, 1080));
  assert.deepEqual(dims, { width: 1920, height: 1080 });
});

test("parseImageDimensionsFromHeader lê largura/altura de um PNG válido", () => {
  const dims = parseImageDimensionsFromHeader(buildPngHeader(800, 600));
  assert.deepEqual(dims, { width: 800, height: 600 });
});

test("parseImageDimensionsFromHeader retorna null para arquivo truncado", () => {
  const fullJpeg = buildJpegHeader(1920, 1080);
  assert.equal(parseImageDimensionsFromHeader(fullJpeg.slice(0, 4)), null); // corta antes do SOF
  assert.equal(parseImageDimensionsFromHeader(fullJpeg.slice(0, 22)), null); // corta no meio do SOF, antes da dimensão
  assert.equal(parseImageDimensionsFromHeader(new Uint8Array(0)), null);
});

test("parseImageDimensionsFromHeader retorna null para formato não reconhecido", () => {
  assert.equal(parseImageDimensionsFromHeader(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])), null); // "%PDF-1.4"
});
