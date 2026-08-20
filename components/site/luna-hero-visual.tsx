"use client";

import { useEffect, useRef } from "react";

/**
 * GENESIS/pacotes/2026-08-20-hero-luna-espaco.md — `referencia_hero-luna-
 * espaco.html` (aprovado pelo Arquiteto, 20/08) é a especificação; esta é a
 * porta 1:1 pra hooks React, valores intocados (inclusive os já reforçados
 * em 50% — ver o próprio pacote, seção "A luz do crânio").
 *
 * Duas cenas independentes, um `requestAnimationFrame` só:
 * - campo de estrelas, absoluto sobre a seção inteira, densidade crescente
 *   pra baixo (expoente < 1 na coordenada vertical — é isso que lê como
 *   horizonte, não desenhar mais estrelas)
 * - sinapses dentro da elipse do crânio da imagem, clipadas nela
 *
 * Cor fixa no escuro (ver `.luna-hero-*` em `app/globals.css`) — decisão
 * registrada de manter a cena escura nos dois temas, não estimada aqui.
 */

const EC = { x: 0.546, y: 0.339, rx: 0.315, ry: 0.285 };
const NODE_COUNT = 26;

type Star = { x: number; y: number; r: number; a: number; ph: number; d: number; g: boolean };
type Node = { x: number; y: number; vx: number; vy: number; g: boolean; ph: number };

export function LunaHeroVisual() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const starsCanvasRef = useRef<HTMLCanvasElement>(null);
  const lunaRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const synapsesCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const sky = starsCanvasRef.current;
    const luna = lunaRef.current;
    const img = imgRef.current;
    const syn = synapsesCanvasRef.current;
    if (!scene || !sky || !luna || !img || !syn) return;

    const sx = sky.getContext("2d");
    const sy = syn.getContext("2d");
    if (!sx || !sy) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let stars: Star[] = [];
    let nodes: Node[] = [];
    let mx = 0.5;
    let my = 0.42;
    let tmx = 0.5;
    let tmy = 0.42;

    function medirCeu() {
      const r = scene!.getBoundingClientRect();
      sky!.width = r.width * dpr;
      sky!.height = r.height * dpr;
      stars = [];
      const n = Math.round((r.width * r.height) / 8000);
      for (let i = 0; i < n; i++) {
        const y = Math.pow(Math.random(), 0.62);
        stars.push({
          x: Math.random(),
          y,
          r: Math.random() * 1.15 + 0.25,
          a: 0.14 + Math.random() * 0.4,
          ph: Math.random() * 6.283,
          d: 0.25 + Math.random() * 0.75,
          g: Math.random() < 0.09,
        });
      }
    }

    function medirSinapses() {
      const r = img!.getBoundingClientRect();
      if (!r.width) return;
      syn!.width = r.width * dpr;
      syn!.height = r.height * dpr;
      syn!.style.width = `${r.width}px`;
      syn!.style.height = `${r.height}px`;
      nodes = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        const t = Math.random() * 6.283;
        const rr = Math.sqrt(Math.random());
        nodes.push({
          x: EC.x + Math.cos(t) * rr * EC.rx,
          y: EC.y + Math.sin(t) * rr * EC.ry,
          vx: (Math.random() - 0.5) * 0.00028,
          vy: (Math.random() - 0.5) * 0.00028,
          g: Math.random() < 0.2,
          ph: Math.random() * 6.283,
        });
      }
    }

    function medir() {
      medirCeu();
      medirSinapses();
    }

    if (img.complete) medir();
    else img.addEventListener("load", medir);

    const resizeObserver = new ResizeObserver(medir);
    resizeObserver.observe(scene);

    let rafId = 0;

    function loop(t: number) {
      mx += (tmx - mx) * 0.06;
      my += (tmy - my) * 0.06;
      const px = mx - 0.5;
      const py = my - 0.5;

      sx!.clearRect(0, 0, sky!.width, sky!.height);
      for (const s of stars) {
        sx!.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(t / 1500 + s.ph));
        sx!.fillStyle = s.g ? "#E4B448" : "#8098B0";
        sx!.beginPath();
        sx!.arc(
          s.x * sky!.width - px * 26 * s.d * dpr,
          s.y * sky!.height - py * 16 * s.d * dpr,
          s.r * dpr,
          0,
          6.283,
        );
        sx!.fill();
      }
      sx!.globalAlpha = 1;

      if (nodes.length) {
        const W = syn!.width;
        const H = syn!.height;
        sy!.clearRect(0, 0, W, H);
        sy!.save();
        sy!.beginPath();
        sy!.ellipse(EC.x * W, EC.y * H, EC.rx * W, EC.ry * H, 0, 0, 6.283);
        sy!.clip();
        for (let a = 0; a < nodes.length; a++) {
          const n = nodes[a]!;
          n.x += n.vx;
          n.y += n.vy;
          const dx = (n.x - EC.x) / EC.rx;
          const dy = (n.y - EC.y) / EC.ry;
          if (dx * dx + dy * dy > 1) {
            n.vx *= -1;
            n.vy *= -1;
          }
          for (let b = a + 1; b < nodes.length; b++) {
            const m = nodes[b]!;
            const ax = (n.x - m.x) * W;
            const ay = (n.y - m.y) * H;
            const d = Math.hypot(ax, ay);
            if (d < W * 0.17) {
              sy!.globalAlpha = (1 - d / (W * 0.17)) * 0.36;
              sy!.strokeStyle = "#3C90CC";
              sy!.lineWidth = dpr;
              sy!.beginPath();
              sy!.moveTo(n.x * W, n.y * H);
              sy!.lineTo(m.x * W, m.y * H);
              sy!.stroke();
            }
          }
          sy!.globalAlpha = 0.375 + 0.45 * Math.sin(t / 800 + n.ph);
          sy!.fillStyle = n.g ? "#E4B448" : "#8098B0";
          sy!.beginPath();
          sy!.arc(n.x * W, n.y * H, (n.g ? 2.5 : 1.9) * dpr, 0, 6.283);
          sy!.fill();
        }
        sy!.restore();
        sy!.globalAlpha = 1;
      }

      luna!.style.transform = `translate3d(${(-px * 10).toFixed(1)}px,${(-py * 7).toFixed(1)}px,0)`;
      rafId = requestAnimationFrame(loop);
    }

    let driftInterval: ReturnType<typeof setInterval> | undefined;
    function onMouseMove(e: MouseEvent) {
      tmx = e.clientX / window.innerWidth;
      tmy = e.clientY / window.innerHeight;
    }

    if (!reduce) {
      window.addEventListener("mousemove", onMouseMove);
      if (!matchMedia("(pointer: fine)").matches) {
        const t0 = performance.now();
        driftInterval = setInterval(() => {
          const e = (performance.now() - t0) / 1000;
          tmx = 0.5 + Math.sin(e * 0.25) * 0.16;
          tmy = 0.42 + Math.cos(e * 0.19) * 0.1;
        }, 80);
      }
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      img.removeEventListener("load", medir);
      window.removeEventListener("mousemove", onMouseMove);
      if (driftInterval) clearInterval(driftInterval);
    };
  }, []);

  return (
    <>
      <div ref={sceneRef} className="luna-hero-horizonte" aria-hidden="true">
        <canvas ref={starsCanvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      <div ref={lunaRef} className="luna-hero-luna">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src="/luna/luna-android.webp"
          srcSet="/luna/luna-android-sm.webp 560w, /luna/luna-android.webp 1080w"
          sizes="(max-width: 640px) 78vw, 360px"
          alt="LUNA — perfil de android com a caixa craniana transparente exibindo geometria analítica."
          draggable={false}
        />
        <canvas ref={synapsesCanvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        <div className="luna-hero-disco" aria-hidden="true" />
      </div>
    </>
  );
}
