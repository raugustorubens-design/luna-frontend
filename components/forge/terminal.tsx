"use client";

// Portado de forge/apps/web/src/components/terminal/Terminal.tsx (monorepo `luna`).
import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { terminalWebSocketUrl } from "@/lib/forge/api-client";

export function Terminal() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    const term = new XTerm({
      fontSize: 13,
      theme: { background: "#0c0f0e" },
      convertEol: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    // Guarded: React 18 StrictMode mounts/cleans up/remounts effects once in
    // dev, e fitAddon.fit() lança se chamado num terminal já descartado
    // pego no meio do ciclo. Inofensivo em produção (sem double-mount), mas
    // vale a pena proteger em vez de deixar um erro não tratado no console.
    const safeFit = () => {
      if (disposed) return;
      try {
        fitAddon.fit();
      } catch {
        // container not measurable yet — next resize observation will retry
      }
    };
    safeFit();

    const socket = new WebSocket(terminalWebSocketUrl());
    socket.onopen = () => term.writeln("LUNA Forge — terminal local conectado.");
    socket.onmessage = (event) => term.write(event.data);
    socket.onclose = () => term.writeln("\r\n[conexão encerrada]");
    socket.onerror = () => term.writeln("\r\n[erro ao conectar ao servidor local do Forge]");

    const dataDisposable = term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    });

    const resizeObserver = new ResizeObserver(safeFit);
    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      dataDisposable.dispose();
      resizeObserver.disconnect();
      socket.close();
      term.dispose();
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full px-2 py-1" />;
}
