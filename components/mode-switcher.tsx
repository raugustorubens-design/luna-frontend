"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ModeSwitcher() {
  const pathname = usePathname();
  // /ronda (ADR-021) é uma superfície própria, standalone, instalável como
  // PWA — sem link de Dev Mode nem qualquer navegação do Modo Usuário.
  //
  // /v2 (ADR-022) entra pelo mesmo motivo: tem cabeçalho próprio com o
  // alternador de tema no canto superior direito, no mesmo lugar onde este
  // link fixo cai — os dois competiam pelo mesmo canto — e já tem seu
  // próprio CTA "Entrar no Forge" no rodapé da página, então o link flutuante
  // seria redundante mesmo sem a sobreposição.
  if (
    pathname?.startsWith("/forge") ||
    pathname?.startsWith("/ronda") ||
    pathname?.startsWith("/v2")
  ) {
    return null;
  }

  return (
    <Link
      href="/forge"
      className="fixed right-4 top-4 z-50 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-luna-textSub backdrop-blur-md hover:text-luna-cyanHi"
    >
      Dev Mode →
    </Link>
  );
}
