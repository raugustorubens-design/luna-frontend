"use client";

import { useEffect } from "react";

/** Escopo restrito a /ronda — não interfere com o Forge nem o Modo Usuário (ver comentário no topo de public/ronda-sw.js). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/ronda-sw.js", { scope: "/ronda" }).catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error("Falha ao registrar o service worker da Ronda:", error);
    });
  }, []);

  return null;
}
