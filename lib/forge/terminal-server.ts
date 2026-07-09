import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { WebSocket, WebSocketServer } from "ws";

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
