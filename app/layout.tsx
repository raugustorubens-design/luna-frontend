import "./globals.css";
import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ModeSwitcher } from "@/components/mode-switcher";

/*
 * ADR-022 — famílias da paleta LUNA, 17/08/2026.
 *
 * Carregadas aqui porque `next/font` precisa ser chamado em escopo de módulo,
 * e o layout raiz é o único ponto que cobre as três superfícies. O que é
 * carregado, porém, não é o que é aplicado: estas variáveis só entram na
 * cascata via `--luna-display/body/mono` (ver `app/globals.css`), lidos
 * exclusivamente pelos componentes novos sob `.luna-v2`. `/`, `/forge` e
 * `/ronda` continuam com a tipografia de hoje — a troca global é etapa
 * própria, não esta.
 *
 * `display: "swap"` e os fallbacks declarados em `--luna-*` cobrem o intervalo
 * antes de a fonte chegar; nenhuma tela depende da fonte para ser legível.
 */
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LUNA Cognitive OS",
  description: "Interface cinematográfica para observabilidade cognitiva persistente"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // As classes de fonte só declaram as variáveis CSS (`--font-*`) no escopo
    // do documento — não trocam `font-family` de nada por si só.
    <html lang="pt-BR" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <ModeSwitcher />
        {children}
      </body>
    </html>
  );
}
