import { RondaCuradoria } from "@/components/ronda/ronda-curadoria";

export default async function RondaCuradoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RondaCuradoria rondaId={id} />;
}
