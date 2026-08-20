"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

/**
 * Ported 1:1 from the `luna-overlay.html` prototype (see PROMPT_CLAUDE_CODE.md).
 * Coordinates below are measured on the source image and must not be
 * recalculated — only the render target (canvas element + React lifecycle)
 * changed from the standalone prototype.
 */
const IMG_W = 1402;
const IMG_H = 1122;
const EAR_IMG = { x: 738, y: 628 };
const ORBIT_CENTER = { x: 700, y: 340 };
const HEAD_CLIP = { x: 700, y: 350, rx: 345, ry: 335 };

const SATELLITES = [
  { id: "guardian", label: "Guardian", ring: 1, gold: true, speed: 0.00034, phase: 0.2 },
  { id: "gateway", label: "Gateway", ring: 1, gold: false, speed: -0.00027, phase: 2.6 },
  { id: "memengine", label: "Memory Engine", ring: 2, gold: true, speed: 0.00021, phase: 1.1 },
  { id: "hipocampo", label: "Hipocampo", ring: 2, gold: false, speed: -0.00019, phase: 3.8 },
  { id: "hub", label: "Connector Hub", ring: 2, gold: false, speed: 0.00023, phase: 5.4 },
  { id: "convergia", label: "Convergia", ring: 3, gold: false, speed: 0.00015, phase: 0.9 },
  { id: "reporter", label: "Reporter", ring: 3, gold: false, speed: -0.00013, phase: 4.2 },
  { id: "router", label: "Model Router", ring: 3, gold: false, speed: 0.00017, phase: 2.1 },
] as const;

const RINGS: Record<number, { rx: number; ry: number }> = {
  1: { rx: 85, ry: 66 },
  2: { rx: 150, ry: 115 },
  3: { rx: 215, ry: 165 },
};

type Pulse = {
  satId: string;
  toCore: boolean;
  progress: number;
  speed: number;
  gold: boolean;
};

function satPos(sat: (typeof SATELLITES)[number], t: number) {
  const r = RINGS[sat.ring];
  const a = sat.phase + t * sat.speed;
  return {
    x: ORBIT_CENTER.x + Math.cos(a) * r.rx,
    y: ORBIT_CENTER.y + Math.sin(a) * r.ry,
  };
}

type LunaCoreProps = Omit<ComponentPropsWithoutRef<"div">, "children">;

export function LunaCore({ className = "", ...rest }: LunaCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let renderW = 0;
    let renderH = 0;
    let offX = 0;
    let offY = 0;
    let scale = 1;

    function layoutImage() {
      W = container!.clientWidth;
      H = container!.clientHeight;
      const imgAR = IMG_W / IMG_H;
      const boxAR = W / H;
      if (boxAR > imgAR) {
        renderH = H;
        renderW = H * imgAR;
        offY = 0;
        offX = (W - renderW) / 2;
      } else {
        renderW = W;
        renderH = W / imgAR;
        offX = 0;
        offY = (H - renderH) / 2;
      }
      scale = renderW / IMG_W;
    }

    function toScreen(imgX: number, imgY: number) {
      return { x: offX + imgX * scale, y: offY + imgY * scale };
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = container!.clientWidth;
      H = container!.clientHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutImage();
    }

    let pulses: Pulse[] = [];
    let spawnTimer = 0;

    function spawnPulse() {
      const sat = SATELLITES[Math.floor(Math.random() * SATELLITES.length)];
      const toCore = Math.random() < 0.5;
      const gold = sat.gold || Math.random() < 0.15;
      pulses.push({
        satId: sat.id,
        toCore,
        progress: 0,
        speed: 0.011 + Math.random() * 0.012,
        gold,
      });
    }

    let tglobal = 0;

    function update(dt: number) {
      tglobal += dt;
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnPulse();
        spawnTimer = 360 + Math.random() * 480;
      }
      pulses.forEach((p) => (p.progress += p.speed));
      pulses = pulses.filter((p) => p.progress < 1);
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);

      const corePt = toScreen(EAR_IMG.x, EAR_IMG.y);
      const orbitPt = toScreen(ORBIT_CENTER.x, ORBIT_CENTER.y);
      const clipPt = toScreen(HEAD_CLIP.x, HEAD_CLIP.y);

      ctx!.save();
      ctx!.beginPath();
      ctx!.ellipse(clipPt.x, clipPt.y, HEAD_CLIP.rx * scale, HEAD_CLIP.ry * scale, 0, 0, Math.PI * 2);
      ctx!.clip();

      Object.values(RINGS).forEach((r) => {
        ctx!.beginPath();
        ctx!.ellipse(orbitPt.x, orbitPt.y, r.rx * scale, r.ry * scale, 0, 0, Math.PI * 2);
        ctx!.strokeStyle = "rgba(120,190,255,0.16)";
        ctx!.setLineDash([2, 5]);
        ctx!.lineWidth = 1;
        ctx!.stroke();
        ctx!.setLineDash([]);
      });

      const pulse = 0.6 + 0.4 * Math.sin(tglobal * 0.0028);
      const g = ctx!.createRadialGradient(corePt.x, corePt.y, 0, corePt.x, corePt.y, 26 * scale * 3);
      g.addColorStop(0, `rgba(255,207,122,${0.3 + pulse * 0.18})`);
      g.addColorStop(0.5, "rgba(111,201,255,0.12)");
      g.addColorStop(1, "rgba(111,201,255,0)");
      ctx!.beginPath();
      ctx!.arc(corePt.x, corePt.y, 26 * scale * 3, 0, Math.PI * 2);
      ctx!.fillStyle = g;
      ctx!.fill();

      const positions: Record<string, { x: number; y: number }> = {};
      SATELLITES.forEach((sat) => {
        const p = satPos(sat, tglobal);
        const sp = toScreen(p.x, p.y);
        positions[sat.id] = sp;

        ctx!.beginPath();
        ctx!.moveTo(corePt.x, corePt.y);
        ctx!.lineTo(sp.x, sp.y);
        ctx!.strokeStyle = sat.gold ? "rgba(255,207,122,0.16)" : "rgba(111,201,255,0.14)";
        ctx!.lineWidth = 1;
        ctx!.stroke();

        const col = sat.gold ? "255,207,122" : "150,210,255";
        const halo = ctx!.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 16 * scale * 3);
        halo.addColorStop(0, `rgba(${col},0.5)`);
        halo.addColorStop(1, `rgba(${col},0)`);
        ctx!.beginPath();
        ctx!.arc(sp.x, sp.y, 16 * scale * 3, 0, Math.PI * 2);
        ctx!.fillStyle = halo;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(sp.x, sp.y, 3.2, 0, Math.PI * 2);
        ctx!.fillStyle = `rgb(${col})`;
        ctx!.shadowColor = `rgb(${col})`;
        ctx!.shadowBlur = 10;
        ctx!.fill();
        ctx!.shadowBlur = 0;

        ctx!.beginPath();
        ctx!.arc(sp.x, sp.y, 6.5, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(${col},0.5)`;
        ctx!.lineWidth = 1;
        ctx!.stroke();

        ctx!.font = '600 11px "JetBrains Mono", monospace';
        ctx!.fillStyle = sat.gold ? "rgba(255,224,175,0.92)" : "rgba(207,230,245,0.85)";
        const rightSide = Math.cos(sat.phase + tglobal * sat.speed) >= 0;
        ctx!.textAlign = rightSide ? "left" : "right";
        ctx!.fillText(sat.label, sp.x + (rightSide ? 9 : -9), sp.y + 3);
      });

      pulses.forEach((p) => {
        const sp = positions[p.satId];
        if (!sp) return;
        const a = p.toCore ? sp : corePt;
        const b = p.toCore ? corePt : sp;
        const t = p.progress;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const col = p.gold ? "255,207,122" : "150,220,255";
        ctx!.beginPath();
        ctx!.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx!.fillStyle = `rgb(${col})`;
        ctx!.shadowColor = `rgb(${col})`;
        ctx!.shadowBlur = 12;
        ctx!.fill();
        ctx!.shadowBlur = 0;
      });

      ctx!.restore();
    }

    let rafId = 0;
    let last = performance.now();

    function loop(now: number) {
      const dt = now - last;
      last = now;
      update(dt);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    resize();
    spawnPulse();
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative bg-transparent ${className}`} {...rest}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/luna/luna-core-reference.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain"
        draggable={false}
      />
      <canvas className="absolute inset-0 h-full w-full" ref={canvasRef} />
    </div>
  );
}
