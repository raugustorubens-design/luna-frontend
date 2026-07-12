import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { IncomingMessage } from "node:http";
import type { WebSocket, WebSocketServer } from "ws";
import { getToken } from "next-auth/jwt";
import { isAllowedEmail } from "./allowed-email";

/**
 * Gate do terminal (revisão de código, achado P1): sem isso, qualquer
 * conexão que alcançasse `/forge/terminal` no serviço público ganhava um
 * shell interativo sem nenhuma checagem — execução de comando arbitrário
 * para qualquer um que soubesse a URL. Em desenvolvimento local (`isDev`,
 * ambiente confiável — só o operador tem acesso à porta), segue liberado.
 *
 * Em produção, dois controles independentes, ambos obrigatórios:
 * 1. Sessão Google válida (via `middleware.ts`/Auth.js) cujo e-mail bate com
 *    `FORGE_ALLOWED_EMAIL` — esta é a camada de autenticação de verdade.
 * 2. Um token que bate com `FORGE_TERMINAL_TOKEN` — mantido como defesa em
 *    profundidade mesmo depois do login Google entrar em cena; sem essa
 *    variável configurada, o terminal fica desabilitado por padrão (nenhum
 *    shell é criado).
 *
 * O WebSocket handshake não passa pelo middleware do Next (ver
 * `createTerminalClientVerifier` abaixo) — por isso a checagem de sessão
 * precisa ser refeita aqui, lendo o mesmo cookie httpOnly que o Auth.js já
 * gerencia, em vez de confiar que o middleware já rodou.
 */
export function verifyTerminalClient(
  isDev: boolean,
  expectedToken: string | undefined,
  requestUrl: string | undefined,
  sessionEmail: string | null,
  allowedEmail: string | undefined,
): { allowed: true } | { allowed: false; code: number; message: string } {
  if (isDev) return { allowed: true };

  if (!isAllowedEmail(sessionEmail, allowedEmail)) {
    return { allowed: false, code: 401, message: "Forge terminal requires an authenticated LUNA session for the allowed account" };
  }

  if (!expectedToken) {
    return { allowed: false, code: 503, message: "Forge terminal is disabled — FORGE_TERMINAL_TOKEN is not configured" };
  }

  const providedToken = new URL(requestUrl ?? "", "http://internal").searchParams.get("token");
  if (providedToken === expectedToken) return { allowed: true };

  return { allowed: false, code: 401, message: "Unauthorized" };
}

/**
 * Lê e decodifica o cookie de sessão do Auth.js diretamente do `IncomingMessage`
 * bruto do handshake — `getToken` não depende do contexto de requisição do
 * Next (`cookies()`/`headers()`), só de `req.headers`, então funciona aqui
 * fora do pipeline normal do Next. `secureCookie` precisa refletir o mesmo
 * protocolo que `AUTH_URL` usa em produção (https), senão o Auth.js procura
 * pelo nome de cookie errado (`__Secure-` vs sem prefixo) e a sessão nunca é
 * encontrada mesmo com um login válido.
 */
async function resolveSessionEmail(req: IncomingMessage): Promise<string | null> {
  const secureCookie = (process.env.AUTH_URL ?? "").startsWith("https://");
  const token = await getToken({
    req: { headers: { cookie: req.headers.cookie ?? "" } },
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });
  return typeof token?.email === "string" ? token.email : null;
}

/** Adapta `verifyTerminalClient` para a assinatura `verifyClient` da `ws` (usada em server.ts). */
export function createTerminalClientVerifier(isDev: boolean) {
  return async (
    info: { req: IncomingMessage },
    callback: (result: boolean, code?: number, message?: string) => void,
  ): Promise<void> => {
    const sessionEmail = isDev ? null : await resolveSessionEmail(info.req);
    const result = verifyTerminalClient(isDev, process.env.FORGE_TERMINAL_TOKEN, info.req.url, sessionEmail, process.env.FORGE_ALLOWED_EMAIL);
    if (result.allowed) {
      callback(true);
    } else {
      callback(false, result.code, result.message);
    }
  };
}

/**
 * Plain command execution over a spawned shell — no automation, no agent
 * loop, exactly what MVP-01 asks for ("Sem automações. Sem agentes. Apenas
 * execução de comandos"). This intentionally does NOT use a real PTY
 * (node-pty): that needs native compilation, which is a real installability
 * risk this MVP doesn't need to take on for "run a command and see the
 * output". Known limitation, registered here rather than hidden: full-screen
 * interactive programs (vim, htop, an actual `ssh` session) will not render
 * correctly without a PTY.
 *
 * Portado de forge/apps/server/src/terminal.ts (monorepo `luna`), sem
 * alterações de lógica — só deixou de rodar num servidor Express dedicado e
 * passou a anexar no mesmo http.Server do custom server do Next.js.
 */
export function attachTerminal(wss: WebSocketServer, workingDirectory: string): void {
  wss.on("connection", (socket: WebSocket) => {
    const shell = process.env.SHELL ?? "/bin/bash";
    const child: ChildProcessWithoutNullStreams = spawn(shell, ["-i"], {
      cwd: workingDirectory,
      env: process.env,
    });

    child.stdout.on("data", (chunk: Buffer) => {
      if (socket.readyState === socket.OPEN) socket.send(chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (socket.readyState === socket.OPEN) socket.send(chunk.toString("utf8"));
    });
    child.on("exit", (code) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(`\r\n[processo encerrado, código ${code}]\r\n`);
        socket.close();
      }
    });

    socket.on("message", (data) => {
      child.stdin.write(data.toString());
    });

    socket.on("close", () => {
      child.kill();
    });
  });
}
