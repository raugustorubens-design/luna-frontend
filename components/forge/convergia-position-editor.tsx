"use client";

// CONV-002 — editor de posicionamento de campo ("bolha" arrastável) do
// Convergia. Cada variável do template vira uma caixa que o usuário arrasta
// e redimensiona sobre um canvas 16:9 representando o slide; posição/tamanho
// em porcentagem da área do slide (0-100), não em EMU — ver comentário em
// lib/forge/api-client.ts sobre a conversão de unidade ficar a cargo do
// backend. Mesmo padrão visual/estrutural de components/forge/: sem
// biblioteca de drag-and-drop externa, só pointer events.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  fetchConvergiaTemplatePositions,
  saveConvergiaTemplatePositions,
  type ConvergiaFieldPosition,
  type ConvergiaTemplateSummary,
} from "@/lib/forge/api-client";

const DEFAULT_WIDTH = 28;
const DEFAULT_HEIGHT = 12;
const MIN_WIDTH = 6;
const MIN_HEIGHT = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Layout inicial em cascata para variáveis sem posição salva ainda — evita todas empilhadas no canto (0,0). */
function defaultPosition(name: string, index: number): ConvergiaFieldPosition {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return {
    name,
    x: clamp(4 + column * (DEFAULT_WIDTH + 4), 0, 100 - DEFAULT_WIDTH),
    y: clamp(6 + row * (DEFAULT_HEIGHT + 6), 0, 100 - DEFAULT_HEIGHT),
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };
}

type DragMode = { name: string; kind: "move" | "resize"; startX: number; startY: number; origin: ConvergiaFieldPosition };

export function ConvergiaPositionEditor({ template }: { template: ConvergiaTemplateSummary }) {
  const [positions, setPositions] = useState<Record<string, ConvergiaFieldPosition>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSaved(false);
    fetchConvergiaTemplatePositions(template.id)
      .then((saved) => {
        if (cancelled) return;
        const byName = new Map(saved.map((position) => [position.name, position]));
        const next: Record<string, ConvergiaFieldPosition> = {};
        template.variables.forEach((variable, index) => {
          next[variable.name] = byName.get(variable.name) ?? defaultPosition(variable.name, index);
        });
        setPositions(next);
      })
      .catch(() => {
        // Sem posições salvas ainda (endpoint pode nem existir no backend) — cascata padrão, editor continua usável.
        if (cancelled) return;
        const next: Record<string, ConvergiaFieldPosition> = {};
        template.variables.forEach((variable, index) => {
          next[variable.name] = defaultPosition(variable.name, index);
        });
        setPositions(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [template.id, template.variables]);

  function handlePointerDown(event: React.PointerEvent, name: string, kind: "move" | "resize") {
    event.preventDefault();
    event.stopPropagation();
    const origin = positions[name];
    if (!origin) return;
    dragRef.current = { name, kind, startX: event.clientX, startY: event.clientY, origin };
    (event.target as Element).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const deltaXPct = ((event.clientX - drag.startX) / rect.width) * 100;
    const deltaYPct = ((event.clientY - drag.startY) / rect.height) * 100;

    setPositions((current) => {
      const existing = current[drag.name];
      if (!existing) return current;
      if (drag.kind === "move") {
        const width = existing.width;
        const height = existing.height;
        return {
          ...current,
          [drag.name]: {
            ...existing,
            x: clamp(drag.origin.x + deltaXPct, 0, 100 - width),
            y: clamp(drag.origin.y + deltaYPct, 0, 100 - height),
          },
        };
      }
      const width = clamp(drag.origin.width + deltaXPct, MIN_WIDTH, 100 - existing.x);
      const height = clamp(drag.origin.height + deltaYPct, MIN_HEIGHT, 100 - existing.y);
      return { ...current, [drag.name]: { ...existing, width, height } };
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await saveConvergiaTemplatePositions(template.id, Object.values(positions));
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Falha ao salvar posições — endpoint de persistência ainda não existe em luna-core.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-xs text-muted-foreground">carregando posições…</p>;

  if (template.variables.length === 0) {
    return <p className="text-xs text-muted-foreground">Este template não declara variáveis posicionáveis.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {loadError && <p className="text-xs text-destructive">{loadError}</p>}
      <p className="text-xs text-muted-foreground">
        Arraste cada campo para posicioná-lo sobre o slide; use a alça no canto inferior direito da caixa para redimensionar.
      </p>
      <div
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative aspect-video w-full select-none overflow-hidden rounded border border-border bg-muted/30"
      >
        {Object.values(positions).map((position) => {
          const variable = template.variables.find((candidate) => candidate.name === position.name);
          return (
            <div
              key={position.name}
              onPointerDown={(event) => handlePointerDown(event, position.name, "move")}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                width: `${position.width}%`,
                height: `${position.height}%`,
              }}
              className="absolute flex cursor-move flex-col justify-between rounded border border-primary/60 bg-primary/10 p-1 text-[10px] leading-tight text-foreground"
              title={variable?.description}
            >
              <span className="truncate font-medium">
                {position.name}
                {variable?.required && <span className="text-destructive"> *</span>}
              </span>
              <div
                onPointerDown={(event) => handlePointerDown(event, position.name, "resize")}
                className="ml-auto h-2.5 w-2.5 shrink-0 cursor-nwse-resize rounded-sm border border-primary bg-background"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        {saved && !saveError && <p className="text-xs text-primary">Posições salvas.</p>}
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar posições"}
        </Button>
      </div>
    </div>
  );
}
