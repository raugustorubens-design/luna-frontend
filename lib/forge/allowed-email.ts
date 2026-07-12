/**
 * Único critério de autorização do Forge: o e-mail autenticado via Google
 * precisa bater com `FORGE_ALLOWED_EMAIL` (variável server-only, nunca
 * `NEXT_PUBLIC_*`). Comparação case-insensitive e com espaços cortados —
 * e-mails não diferenciam maiúsculas/minúsculas na prática, e evita falhas
 * silenciosas por um espaço extra colado na variável de ambiente.
 *
 * Usado tanto pelo callback `signIn` do Auth.js (rejeita o login em si,
 * não só a exibição de UI) quanto pelo handshake do WebSocket do terminal
 * (que não passa pelo middleware do Next — ver `terminal-server.ts`).
 */
export function isAllowedEmail(email: string | null | undefined, allowedEmail: string | undefined): boolean {
  if (!email || !allowedEmail) return false;
  return email.trim().toLowerCase() === allowedEmail.trim().toLowerCase();
}
