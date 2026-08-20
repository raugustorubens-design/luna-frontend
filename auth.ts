import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "./lib/forge/allowed-email";

/**
 * Protege duas áreas restritas com o mesmo login Google, cada uma com sua
 * própria allowlist (`2026-08-19-acesso-publico.md`, Etapa 3): o /forge (Dev
 * Mode, `FORGE_ALLOWED_EMAIL`, uma conta só) e o /ronda (Safety Walk,
 * `RONDA_ALLOWED_EMAILS`, os técnicos de campo). O Modo Usuário (`/`) nunca
 * passa por este arquivo — só as rotas listadas no `matcher` de
 * `middleware.ts`.
 *
 * Este callback só decide **se a pessoa consegue logar** — estar numa das
 * duas listas basta pra isso. **O que ela alcança depois de logada** é
 * decisão de `middleware.ts`, rota por rota: um e-mail só do /ronda que
 * tentar abrir /forge é barrado lá, não aqui — as listas não se misturam.
 *
 * `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` são detectados automaticamente
 * pelo Auth.js a partir do nome do provider (convenção `AUTH_<PROVIDER>_ID`/
 * `_SECRET>`) — não precisam ser passados explicitamente aqui.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  // `2026-08-19-acesso-publico.md`, Etapa 2 — sem isto, um e-mail fora das
  // duas allowlists cai na tela de erro padrão do NextAuth (beco sem saída,
  // só "Entrar", nome técnico do erro na cara). `app/acesso-negado/page.tsx`
  // troca isso por explicação curta + link de volta ao site.
  pages: {
    error: "/acesso-negado",
  },
  session: {
    // Etapa 3, armadilha (a): sessão padrão expira rápido demais pra uso de
    // campo — o técnico faz a ronda longe de sinal, às vezes por horas, e a
    // sessão não pode caducar no meio disso. 30 dias é o mínimo pedido;
    // explícito aqui (em vez de depender do default do Auth.js, que também
    // é 30 dias hoje) porque esse valor é uma decisão deste pacote, não um
    // acidente de versão da lib. `updateAge` fica no default (Auth.js
    // renova a expiração a cada uso, respeitado sem precisar declarar).
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    /**
     * Rejeita o login de verdade (nenhuma sessão é criada) quando o e-mail
     * não está em nenhuma das duas allowlists — não é apenas "não mostrar"
     * algo na UI depois. Auth.js redireciona para `pages.error` (acima)
     * quando este callback retorna `false`.
     */
    async signIn({ user }) {
      return (
        isAllowedEmail(user.email, process.env.FORGE_ALLOWED_EMAIL) ||
        isAllowedEmail(user.email, process.env.RONDA_ALLOWED_EMAILS)
      );
    },
  },
});
