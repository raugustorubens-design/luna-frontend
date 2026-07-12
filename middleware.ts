import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Cobre toda a superfície do Forge que expõe capacidade via Gateway hoje:
 * a página (`/forge` — Explorer, Editor, chat, painel GitHub) e suas rotas
 * de servidor (`/api/forge/*`, ex. git-status). O handshake do WebSocket do
 * terminal (`/forge/terminal`) NÃO passa por aqui — ele é interceptado pelo
 * `WebSocketServer` direto no `http.Server` antes de chegar no request
 * handler do Next (ver `server.ts`), por isso tem sua própria checagem de
 * sessão em `lib/forge/terminal-server.ts`.
 *
 * O Modo Usuário (`/`) não está no matcher — permanece público, sem
 * nenhuma mudança.
 *
 * Em desenvolvimento local (`NODE_ENV !== "production"`) o gate é
 * dispensado, na mesma linha do próprio terminal (`terminal-server.ts`):
 * ambiente confiável, só o operador tem acesso à porta, e exigir um login
 * Google configurado localmente só para rodar `pnpm dev` seria fricção sem
 * ganho de segurança real.
 */
export default auth((req) => {
  if (process.env.NODE_ENV !== "production") return;

  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/forge/:path*", "/api/forge/:path*"],
};
