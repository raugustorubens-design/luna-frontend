/**
 * Critério de autorização por allowlist de e-mail — usado pelas duas áreas
 * restritas do site, cada uma com a sua própria variável e a sua própria
 * lista (`2026-08-19-acesso-publico.md`, Etapa 3: "não misture as listas" —
 * quem faz ronda não entra no Forge, e vice-versa):
 *
 * - `FORGE_ALLOWED_EMAIL` — uma conta só, a do Arquiteto.
 * - `RONDA_ALLOWED_EMAILS` — lista separada por vírgula, os técnicos de
 *   campo além do Arquiteto.
 *
 * A mesma função serve as duas: um e-mail único é só uma lista de um
 * elemento sem vírgula. Comparação case-insensitive e com espaços cortados
 * em cada elemento — e-mails não diferenciam maiúsculas/minúsculas na
 * prática, e evita falhas silenciosas por um espaço extra colado na
 * variável de ambiente (direto ou depois de uma vírgula).
 *
 * Usado pelo callback `signIn` do Auth.js (rejeita o login em si, não só a
 * exibição de UI), pelo `middleware.ts` (decide o que a sessão já aberta
 * alcança) e pelo handshake do WebSocket do terminal do Forge (que não
 * passa pelo middleware do Next — ver `terminal-server.ts`).
 */
export function isAllowedEmail(email: string | null | undefined, allowedEmails: string | undefined): boolean {
  if (!email || !allowedEmails) return false;
  const target = email.trim().toLowerCase();
  return allowedEmails
    .split(",")
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}
