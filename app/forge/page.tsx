import { ForgeLayout } from "@/components/forge/forge-layout";
import { ForgeLayoutV2 } from "@/components/forge/forge-layout-v2";

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

export default async function ForgePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; layout?: string }>;
}) {
  const { tab, layout } = await searchParams;
  const initialTab = tab === "convergia" ? "convergia" : "workspace";
  // ADR-022 — `/forge` continua exatamente como hoje; `/forge?layout=v2`
  // abre o novo. `?tab=convergia` é link salvo e precisa continuar
  // funcionando nos dois: no v2 a Convergia vira alvo da trilha, mas o
  // parâmetro antigo ainda leva lá (ver `forge-layout-v2.tsx`).
  return layout === "v2" ? (
    <ForgeLayoutV2 initialTab={initialTab} />
  ) : (
    <ForgeLayout initialTab={initialTab} /> // padrão, inalterado
  );
}
