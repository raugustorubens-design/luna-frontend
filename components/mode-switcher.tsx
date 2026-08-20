"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";

function ModeSwitcherLink() {
  const pathname = usePathname();
  const { status } = useSession();
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

  // `2026-08-19-acesso-publico.md`, Etapa 1: um visitante que abre `/` ou
  // `/v2` não pode ver este link — é a porta trancada do Forge oferecida a
  // quem só veio ver a apresentação. `status !== "authenticated"` cobre os
  // dois casos que importam aqui: sem sessão (não renderiza nada, nem
  // desabilitado) e ainda carregando (evita o flash de aparecer e sumir
  // antes de a sessão resolver).
  //
  // Em desenvolvimento local o `middleware.ts` já dispensa o login do
  // Forge — gatear este link pela sessão nesse ambiente escondê-lo-ia sem
  // necessidade (ninguém loga pra rodar `pnpm dev`), então aqui ele segue
  // sempre visível fora de produção, mesma linha do middleware.
  if (process.env.NODE_ENV === "production" && status !== "authenticated") {
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

/**
 * `SessionProvider` fica só aqui, ao redor do link — não no layout raiz —
 * de propósito: ele lê a sessão no cliente (`fetch` a `/api/auth/session`
 * depois de montado), então não força o layout raiz a virar dinâmico. O
 * custo fica isolado neste componente, que já era "use client".
 */
export function ModeSwitcher() {
  return (
    <SessionProvider>
      <ModeSwitcherLink />
    </SessionProvider>
  );
}
