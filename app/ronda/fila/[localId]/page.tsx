import { RondaQueueEditor } from "@/components/ronda/ronda-editor";

/**
 * Ronda que ainda está neste aparelho (fila offline). Rota própria, e não o
 * mesmo `/ronda/historico/[id]` do servidor, de propósito: os dois ids vêm
 * de espaços diferentes (`ronda_<uuid>` do servidor, `localId` da fila) e
 * decidir qual é qual por formato do id seria uma adivinhação silenciosa —
 * a rota diz de onde o registro vem, sem depender de heurística.
 */
export default async function RondaFilaPage({ params }: { params: Promise<{ localId: string }> }) {
  const { localId } = await params;
  return <RondaQueueEditor localId={localId} />;
}
