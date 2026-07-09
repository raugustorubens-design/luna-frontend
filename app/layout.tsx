import "./globals.css";
import type { Metadata } from "next";
import { ModeSwitcher } from "@/components/mode-switcher";

export const metadata: Metadata = {
  title: "LUNA Cognitive OS",
  description: "Interface cinematográfica para observabilidade cognitiva persistente"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ModeSwitcher />
        {children}
      </body>
    </html>
  );
}
