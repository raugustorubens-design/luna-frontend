import type { RondaPhoto } from "./types";

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
export function compressPhoto(file: File): Promise<RondaPhoto> {
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

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const dataBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      resolve({ dataBase64, mimeType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler a foto selecionada."));
    };
    img.src = objectUrl;
  });
}
