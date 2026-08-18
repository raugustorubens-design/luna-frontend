import type { RondaPhoto } from "./types";

/** Versão de campo recém-comprimida, ainda como binário. Vira `RondaPhoto` (base64) só se precisar ser guardada/enviada embutida no relatório. */
export interface CompressedPhoto {
  blob: Blob;
  mimeType: string;
}

const JPEG_QUALITY = 0.7;

/**
 * Teto do lado maior, por proporção. Fixo em 1280px estraga panorâmica: uma
 * de 4:1 fica com 320px de altura, ilegível justamente no detalhe que a
 * justificou (achado de campo, PR 1 — câmera nativa liberada de volta pelo
 * `capture` opcional). Os números vêm do destino: meia largura de slide
 * 16:9 a 150dpi pede ~1000px; panorâmica na largura do slide pede ~2000px.
 */
const STANDARD_LONG_SIDE = 1280;
const PANORAMA_LONG_SIDE = 2000;
const PANORAMA_RATIO_THRESHOLD = 2.5;

/** Só a parte pura do teto — testável sem File/Blob/canvas. */
export function resizeCeilingFor(width: number, height: number): number {
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height) || 1;
  const ratio = longSide / shortSide;
  return ratio > PANORAMA_RATIO_THRESHOLD ? PANORAMA_LONG_SIDE : STANDARD_LONG_SIDE;
}

// Bytes suficientes para os cabeçalhos de JPEG (marcadores até o SOF, que em
// fotos reais vem cedo — antes de EXIF/thumbnail embutido ultrapassarem
// isso seria incomum) e PNG (IHDR está sempre nos primeiros 33 bytes).
const HEADER_PEEK_BYTES = 65536;

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Lê largura/altura direto do cabeçalho — sem decodificar a imagem — para
 * `compressPhoto` poder pedir a `createImageBitmap` um bitmap já no tamanho
 * final, em vez de decodificar em resolução plena pra só depois reduzir
 * (12MP ~= 49MB de RGBA; 48MP, uma panorâmica típica, ~= 192MB). Formato não
 * reconhecido ou cabeçalho incompleto retornam `null` — quem chama cai no
 * caminho de decodificação plena, preservado como estava.
 *
 * Puro (opera sobre bytes, não sobre `File`) de propósito: testável com
 * cabeçalho JPEG válido, PNG válido e arquivo truncado, sem mock de Blob.
 */
export function parseImageDimensionsFromHeader(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 8) return null;

  if (PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    if (bytes.length < 24) return null;
    const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunkType !== "IHDR") return null;
    const width = readUint32BE(bytes, 16);
    const height = readUint32BE(bytes, 20);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) return null; // corrompido ou não é bem JPEG
      const marker = bytes[offset + 1];
      offset += 2;

      // Marcadores sem campo de tamanho: SOI/EOI, RSTn, TEM.
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (marker === 0xda) return null; // Start of Scan — cabeçalhos acabaram, sem SOF encontrado

      if (offset + 2 > bytes.length) return null; // truncado antes do campo de tamanho
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2) return null; // segmento malformado

      // SOFn (0xC0–0xCF, exceto 0xC4 DHT, 0xC8 JPG reservado, 0xCC DAC) —
      // o único grupo que carrega dimensão: 1 byte precisão, 2 altura, 2 largura.
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        if (offset + 7 > bytes.length) return null; // truncado antes da dimensão
        const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        return width > 0 && height > 0 ? { width, height } : null;
      }

      offset += length;
    }
    return null; // truncado antes de achar um SOF
  }

  return null; // formato não reconhecido
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const buffer = await file.slice(0, HEADER_PEEK_BYTES).arrayBuffer();
    return parseImageDimensionsFromHeader(new Uint8Array(buffer));
  } catch {
    return null;
  }
}

/** Desenha o bitmap, comprime e libera os dois — canvas OffScreen quando disponível, para não depender do DOM. */
async function drawAndEncode(bitmap: ImageBitmap): Promise<Blob | null> {
  const { width, height } = bitmap;
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      throw new Error("Canvas 2D não disponível neste navegador.");
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
    canvas.width = 0;
    canvas.height = 0;
    return blob;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas 2D não disponível neste navegador.");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/**
 * Caminho rápido: decodifica já no tamanho final. `createImageBitmap` só
 * preenche a dimensão omitida preservando proporção quando *apenas uma* das
 * duas (`resizeWidth`/`resizeHeight`) é informada — as duas juntas forçam
 * dimensão exata e distorcem. Por isso só o lado maior é informado aqui, com
 * base na dimensão lida do cabeçalho.
 *
 * `imageOrientation: "from-image"` é obrigatório — sem isso a orientação
 * EXIF (universal em foto de celular) é ignorada e a imagem sai deitada.
 */
async function compressWithImageBitmap(file: File, dims: { width: number; height: number }): Promise<CompressedPhoto> {
  const ceiling = resizeCeilingFor(dims.width, dims.height);
  const targetLongSide = Math.min(Math.max(dims.width, dims.height), ceiling);
  const resizeOption: Partial<ImageBitmapOptions> = dims.width >= dims.height ? { resizeWidth: targetLongSide } : { resizeHeight: targetLongSide };

  const bitmap = await createImageBitmap(file, {
    ...resizeOption,
    resizeQuality: "high",
    imageOrientation: "from-image",
  });
  const blob = await drawAndEncode(bitmap);
  if (!blob) throw new Error("Não foi possível comprimir a foto neste navegador.");
  return { blob, mimeType: "image/jpeg" };
}

/**
 * Caminho preservado — decodifica em resolução plena antes de reduzir.
 * Único caminho até este PR; agora só o de contingência, para quando o
 * cabeçalho não pôde ser lido (formato não reconhecido, arquivo truncado)
 * ou `createImageBitmap` não está disponível neste navegador.
 */
function compressWithCanvasImage(file: File): Promise<CompressedPhoto> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, STANDARD_LONG_SIDE / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D não disponível neste navegador."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          canvas.width = 0;
          canvas.height = 0;
          if (!blob) {
            reject(new Error("Não foi possível comprimir a foto neste navegador."));
            return;
          }
          resolve({ blob, mimeType: "image/jpeg" });
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler a foto selecionada."));
    };
    img.src = objectUrl;
  });
}

/**
 * Câmera nativa de um celular real produz fotos de vários MB — inviável
 * para IndexedDB (quota do navegador) e para o payload JSON de
 * `POST /convergia/ronda` em rede de campo ruim. Redimensiona (teto por
 * proporção, ver `resizeCeilingFor`) e recomprime como JPEG antes de
 * guardar/enviar — mesmo princípio de "foto pequena dentro do registro" que
 * `convergia_visual_templates` já assume do lado do servidor, aplicado aqui
 * do lado do cliente, antes mesmo de a foto entrar na fila offline.
 *
 * Tenta primeiro decodificar já reduzido (`compressWithImageBitmap`) — exige
 * saber a dimensão original sem decodificar, por isso o cabeçalho é lido
 * antes. Falha em ler o cabeçalho, formato não reconhecido, ou o próprio
 * `createImageBitmap` falhando: cai no caminho antigo, que sempre funcionou.
 */
export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  if (typeof createImageBitmap === "function") {
    const dims = await readImageDimensions(file);
    if (dims) {
      try {
        return await compressWithImageBitmap(file, dims);
      } catch {
        // cai no caminho de baixo
      }
    }
  }
  return compressWithCanvasImage(file);
}

/**
 * Converte a versão de campo para o formato que viaja embutido no relatório.
 * Só é chamada no caminho de contingência — foto que não conseguiu subir na
 * hora e vai ter que esperar dentro do payload da ronda.
 */
export function photoToBase64(photo: CompressedPhoto): Promise<RondaPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ dataBase64: result.slice(result.indexOf(",") + 1), mimeType: photo.mimeType });
    };
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler a foto comprimida."));
    reader.readAsDataURL(photo.blob);
  });
}
