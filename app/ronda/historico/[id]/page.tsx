import { RondaEditor } from "@/components/ronda/ronda-editor";

export default async function RondaHistoricoEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RondaEditor rondaId={id} />;
}
