import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/ronda/register-service-worker";
import { RondaThemeProvider } from "@/components/ronda/theme-provider";
import { ViewportLock } from "@/components/ronda/viewport-lock";

/**
 * Superfície nova e separada do Forge (ADR-021, Decisão 1) — mobile-first,
 * instalável como PWA. `manifest`/`viewport` aqui sobrescrevem os do layout
 * raiz só para esta subárvore de rotas (comportamento padrão de metadata
 * do Next.js), sem afetar `/forge` nem o Modo Usuário.
 */
export const metadata: Metadata = {
  title: "LUNA Safety Walk",
  description: "Coleta de segurança (SSMA) do LUNA Safety Walk, com fila offline — ADR-021",
  manifest: "/ronda-manifest.json",
  // iOS não segue os ícones do manifest.json de forma confiável em todas as
  // versões — precisa também do <link rel="apple-touch-icon"> gerado a
  // partir disto para "adicionar à tela inicial" funcionar direito no iOS.
  icons: { apple: "/ronda-icons/icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LUNA Safety Walk",
  },
};

export const viewport: Viewport = {
  // Pacote "Safety Walk para o Padrão de Cores" (19/08/2026, ADR-024) —
  // era "#1E2761" (Midnight), o fim do degradê antigo. `#000206` é o topo
  // do degradê de agora (ver theme-provider.tsx) e o que a barra de
  // status translúcida do iOS (`statusBarStyle: "black-translucent"`,
  // abaixo) na prática se sobrepõe — corrige uma incoerência que já
  // existia: o valor antigo apontava pro fim do degradê, não pro começo,
  // onde a barra do sistema realmente fica. Cor da UI do navegador/SO, não
  // muda com a alternância claro/escuro em si.
  themeColor: "#000206",
  width: "device-width",
  initialScale: 1,
  // `maximumScale: 1` foi removido (achado de campo, 16/08/2026). Ele não
  // impede o zoom automático que o iOS dá ao focar um campo com fonte menor
  // que 16px — só impede a pessoa de desfazer esse zoom com o gesto de
  // pinça. O resultado em campo era a tela travada ampliada e deslocada,
  // com cabeçalho e botões fora do visível, sem saída a não ser fechar e
  // reabrir o app. A causa raiz (fonte < 16px nos campos) está corrigida em
  // `globals.css`; travar a escala por cima disso só tirava a última
  // válvula de escape — e, de quebra, quebrava a acessibilidade de quem
  // precisa ampliar pra ler.
  viewportFit: "cover",
  // Teclado do Android passa a encolher a viewport em vez de cobrir o
  // rodapé — sem isto, os botões Voltar/Avançar ficam por baixo do teclado.
  interactiveWidget: "resizes-content",
};

export default function RondaLayout({ children }: { children: React.ReactNode }) {
  return (
    <RondaThemeProvider>
      <ViewportLock />
      <RegisterServiceWorker />
      {children}
    </RondaThemeProvider>
  );
}
