import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/ronda/register-service-worker";

/**
 * Superfície nova e separada do Forge (ADR-021, Decisão 1) — mobile-first,
 * instalável como PWA. `manifest`/`viewport` aqui sobrescrevem os do layout
 * raiz só para esta subárvore de rotas (comportamento padrão de metadata
 * do Next.js), sem afetar `/forge` nem o Modo Usuário.
 */
export const metadata: Metadata = {
  title: "LUNA Ronda",
  description: "Coleta de ronda de segurança (SSMA) com fila offline — ADR-021",
  manifest: "/ronda-manifest.json",
  // iOS não segue os ícones do manifest.json de forma confiável em todas as
  // versões — precisa também do <link rel="apple-touch-icon"> gerado a
  // partir disto para "adicionar à tela inicial" funcionar direito no iOS.
  icons: { apple: "/ronda-icons/icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LUNA Ronda",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RondaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0a0c10] text-slate-100">
      <RegisterServiceWorker />
      {children}
    </div>
  );
}
