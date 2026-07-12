import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "./lib/forge/allowed-email";

/**
 * Protege o /forge (Dev Mode) com login Google restrito a uma única conta
 * (`FORGE_ALLOWED_EMAIL`). O Modo Usuário (`/`) nunca passa por este
 * arquivo — só as rotas listadas no `matcher` de `middleware.ts`.
 *
 * `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` são detectados automaticamente
 * pelo Auth.js a partir do nome do provider (convenção `AUTH_<PROVIDER>_ID`/
 * `_SECRET>`) — não precisam ser passados explicitamente aqui.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    /**
     * Rejeita o login de verdade (nenhuma sessão é criada) quando o e-mail
     * não está na allowlist — não é apenas "não mostrar" algo na UI depois.
     * Auth.js redireciona para a página de erro padrão (`AccessDenied`)
     * quando este callback retorna `false`.
     */
    async signIn({ user }) {
      return isAllowedEmail(user.email, process.env.FORGE_ALLOWED_EMAIL);
    },
  },
});
