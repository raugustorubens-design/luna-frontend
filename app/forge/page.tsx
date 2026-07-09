import { ForgeLayout } from "@/components/forge/forge-layout";

export const metadata = {
  title: "LUNA Forge — Dev Mode",
  description: "Ambiente oficial de engenharia da LUNA",
};

// O Forge é uma ferramenta interativa (Monaco, xterm, WebSocket) sem sentido
// em pré-renderização estática — algumas dependências client-only (xterm/
// monaco) tocam `self` em module scope, o que quebra o worker de export
// estático do `next build`. Renderização dinâmica evita isso e é o
// comportamento correto para esta rota de qualquer forma.
export const dynamic = "force-dynamic";

export default function ForgePage() {
  return <ForgeLayout />;
}
