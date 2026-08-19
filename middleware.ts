import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/forge/allowed-email";

/**
 * Cobre as duas áreas restritas do site, cada uma com sua allowlist própria
 * (`2026-08-19-acesso-publico.md`, Etapa 3):
 *
 * - Forge (Dev Mode) — a página (`/forge`) e suas rotas de servidor
 *   (`/api/forge/*`, ex. git-status), `FORGE_ALLOWED_EMAIL`.
 * - Ronda (Safety Walk) — `/ronda` inteiro, `RONDA_ALLOWED_EMAILS`.
 *
 * O handshake do WebSocket do terminal (`/forge/terminal`) NÃO passa por
 * aqui — ele é interceptado pelo `WebSocketServer` direto no `http.Server`
 * antes de chegar no request handler do Next (ver `server.ts`), por isso
 * tem sua própria checagem de sessão em `lib/forge/terminal-server.ts`.
 *
 * O Modo Usuário (`/`, `/v2`) não está no matcher — permanece público, sem
 * nenhuma mudança.
 *
 * `auth.ts` só decide **se a pessoa consegue logar** (estar numa das duas
 * listas basta) — **o que ela alcança** é decidido aqui, rota por rota: uma
 * sessão válida só pro /ronda que tentar abrir /forge (ou vice-versa) é
 * barrada, mesmo com login bem-sucedido. As listas não se misturam.
 *
 * Em desenvolvimento local (`NODE_ENV !== "production"`) o gate é
 * dispensado, na mesma linha do próprio terminal (`terminal-server.ts`):
 * ambiente confiável, só o operador tem acesso à porta, e exigir um login
 * Google configurado localmente só para rodar `pnpm dev` seria fricção sem
 * ganho de segurança real.
 */
export default auth((req) => {
  if (process.env.NODE_ENV !== "production") return;

  const path = req.nextUrl.pathname;
  const isForgeArea = path.startsWith("/forge") || path.startsWith("/api/forge");
  const allowedEmails = isForgeArea ? process.env.FORGE_ALLOWED_EMAIL : process.env.RONDA_ALLOWED_EMAILS;

  if (isAllowedEmail(req.auth?.user?.email, allowedEmails)) return;

  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  // Sessão existe, mas o e-mail não está na allowlist desta área
  // especificamente (ex.: técnico do /ronda tentando abrir /forge).
  // Mandar de volta pro login de novo reautenticaria em silêncio com a
  // mesma conta Google e cairia no mesmo lugar — um loop. Direto pra
  // página de acesso negado em vez disso.
  return NextResponse.redirect(new URL("/acesso-negado", req.nextUrl.origin));
});

export const config = {
  matcher: ["/forge/:path*", "/api/forge/:path*", "/ronda/:path*"],
};
