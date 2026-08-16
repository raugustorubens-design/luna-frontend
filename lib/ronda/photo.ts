import type { RondaPhoto } from "./types";

/** Versão de campo recém-comprimida, ainda como binário. Vira `RondaPhoto` (base64) só se precisar ser guardada/enviada embutida no relatório. */
export interface CompressedPhoto {
  blob: Blob;
  mimeType: string;
}

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;

/**
 * Câmera nativa de um celular real produz fotos de vários MB — inviável
 * para IndexedDB (quota do navegador) e para o payload JSON de
 * `POST /convergia/ronda` em rede de campo ruim. Redimensiona (lado maior
 * até 1280px) e recomprime como JPEG antes de guardar/enviar — mesmo
 * princípio de "foto pequena dentro do registro" que `convergia_visual_templates`
 * já assume do lado do servidor, aplicado aqui do lado do cliente, antes
 * mesmo de a foto entrar na fila offline.
 */
export function compressPhoto(file: File): Promise<CompressedPhoto> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
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

      // `toBlob` e não `toDataURL`: a Camada 2 (16/08/2026) manda a foto
      // pela rede como binário, e base64 infla 33%. O caminho offline ainda
      // precisa da string — mas aí ela é derivada sob demanda
      // (`photoToBase64`), em vez de ser sempre paga, inclusive quando a
      // foto vai subir direto e os bytes nunca tocam o IndexedDB.
      canvas.toBlob(
        (blob) => {
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
