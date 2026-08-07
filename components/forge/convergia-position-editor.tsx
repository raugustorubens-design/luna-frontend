"use client";

// CONV-002 — editor de posicionamento de campo ("bolha" arrastável) do
// Convergia. Cada campo vira uma caixa que o usuário arrasta e
// redimensiona sobre um canvas 16:9 representando o slide; posição/tamanho
// em porcentagem da área do slide (0-100), não em EMU — ver comentário em
// lib/forge/api-client.ts sobre a conversão de unidade ficar a cargo do
// backend. Mesmo padrão visual/estrutural de components/forge/: sem
// biblioteca de drag-and-drop externa, só pointer events.
//
// CONV-001 — dois acréscimos: (1) campos não vêm mais só de
// `template.variables` pré-declaradas — o usuário pode adicionar campos
// livremente ("adicionar campo"), necessário para um template visual
// (imagem de fundo enviada pelo usuário), que não declara nenhuma
// variável de antemão; (2) cada campo tem `fontSize`/`fontFamily`
// configuráveis, para o texto renderizado bater com a tipografia do
// template real. Quando o template tem imagem de fundo (visual), o
// canvas mostra essa imagem em vez do fundo cinza padrão — via
// `convergiaTemplateImageUrl`, que devolve 404 silenciosamente para
// templates pré-codificados (sem imagem), então o fundo cinza continua
// aparecendo para eles.
//
// CONV-003 (escopo A, decidido — não é o preview real via .pptx, esse é
// escopo B, não implementado): preview instantâneo 100% client-side, só
// para templates visuais (`backgroundLoaded`). "Valor de exemplo" por
// campo é estado local deste componente, nunca enviado pro backend
// (não faz parte de `ConvergiaFieldPosition`/o payload de
// `saveConvergiaTemplatePositions`) — existe só pra essa sessão de
// edição. O texto de exemplo é renderizado na caixa com o `fontSize`/
// `fontFamily` reais do campo via CSS, usando `cqw` (container query
// width, `container-type: inline-size` no canvas): `fontSize` em pt vira
// `(fontSize / larguraRealDoSlideEmPt) * 100` unidades de `cqw` — escala
// com o tamanho real do canvas na tela, sem precisar de ResizeObserver. É
// aproximação de CSS, não o resultado real do PowerPoint (fontes
// diferentes têm métricas diferentes, sem kerning/hinting real) — texto
// de ajuda na UI deixa isso explícito.
//
// Fix (slide não nasce mais sempre 16:9): a largura real do slide em
// pontos vem de `template.slideSize` (luna-core, `GET /convergia/templates`
// — calculada a partir da proporção real da imagem enviada, não mais um
// valor fixo de 720pt/16:9 assumido aqui). `fontSizeToCqw` continua com a
// mesma fórmula de sempre, só a base passou a ser dinâmica — só a régua
// estava errada, não a conta. `SLIDE_WIDTH_PT_FALLBACK` (720, mesmo valor
// fixo de antes) só entra quando `template.slideSize` não existe: template
// pré-codificado, ou template visual enviado antes desta correção (sem
// dimensão de imagem salva) — mesmo comportamento de antes para esses
// dois casos, não quebra nada que já funcionava.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  fetchConvergiaTemplatePositions,
  saveConvergiaTemplatePositions,
  convergiaTemplateImageUrl,
  CONVERGIA_SAFE_FONTS,
  CONVERGIA_DEFAULT_FONT_SIZE,
  CONVERGIA_DEFAULT_FONT_FAMILY,
  type ConvergiaFieldPosition,
  type ConvergiaTemplateSummary,
} from "@/lib/forge/api-client";

const DEFAULT_WIDTH = 28;
const DEFAULT_HEIGHT = 12;
const MIN_WIDTH = 6;
const MIN_HEIGHT = 4;
/** `pptxgenjs`'s default layout (LAYOUT_16x9): 10in × 5.625in = 720pt de largura — usado só quando `template.slideSize` não está disponível (template pré-codificado, ou visual enviado antes do fix de slide real). */
const SLIDE_WIDTH_PT_FALLBACK = 720;

/** `fontSize` (pt) do campo, convertido pra `cqw` do canvas (`container-type: inline-size`) — escala com o tamanho real renderizado, sem JS de resize. `slideWidthPt` é a largura real do slide (`template.slideSize`), não mais um valor fixo — a fórmula em si não mudou. */
function fontSizeToCqw(fontSizePt: number, slideWidthPt: number): string {
  return `${(fontSizePt / slideWidthPt) * 100}cqw`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Layout inicial em cascata para campos sem posição salva ainda — evita todos empilhados no canto (0,0). */
function defaultPosition(name: string, index: number): ConvergiaFieldPosition {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return {
    name,
    x: clamp(4 + column * (DEFAULT_WIDTH + 4), 0, 100 - DEFAULT_WIDTH),
    y: clamp(6 + row * (DEFAULT_HEIGHT + 6), 0, 100 - DEFAULT_HEIGHT),
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    fontSize: CONVERGIA_DEFAULT_FONT_SIZE,
    fontFamily: CONVERGIA_DEFAULT_FONT_FAMILY,
  };
}

type DragMode = { name: string; kind: "move" | "resize"; startX: number; startY: number; origin: ConvergiaFieldPosition };

export function ConvergiaPositionEditor({ template }: { template: ConvergiaTemplateSummary }) {
  const [positions, setPositions] = useState<Record<string, ConvergiaFieldPosition>>({});
  const [fieldOrder, setFieldOrder] = useState<string[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  /** CONV-003 — só preview, nunca persistido (não faz parte do payload salvo). */
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);

  const backgroundImageUrl = convergiaTemplateImageUrl(template.id);
  const slideWidthPt = template.slideSize?.widthPt ?? SLIDE_WIDTH_PT_FALLBACK;
  /** Proporção real do slide (luna-core, `pptx-renderer.ts`) — mesma razão largura/altura da imagem enviada, calculada em pontos, mas equivalente à razão em pixel. `aspect-video` (16:9 fixo) só entra como fallback via className, quando não há imagem carregada ou dimensão conhecida — ver `aspectRatioStyle` abaixo. */
  const aspectRatioStyle =
    backgroundLoaded && template.slideSize ? { aspectRatio: `${template.slideSize.widthPt} / ${template.slideSize.heightPt}` } : undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSaved(false);
    setBackgroundLoaded(false);
    setSampleValues({});
    fetchConvergiaTemplatePositions(template.id)
      .then((saved) => {
        if (cancelled) return;
        const byName = new Map(saved.map((position) => [position.name, position]));
        // Campos pré-declarados pelo template (se houver) sempre aparecem;
        // qualquer outro campo já salvo (adicionado manualmente numa sessão
        // anterior) também — união das duas fontes, não uma sobrescrevendo a outra.
        const names = new Set<string>([...template.variables.map((variable) => variable.name), ...byName.keys()]);
        const next: Record<string, ConvergiaFieldPosition> = {};
        const order: string[] = [];
        [...names].forEach((name, index) => {
          next[name] = byName.get(name) ?? defaultPosition(name, index);
          order.push(name);
        });
        setPositions(next);
        setFieldOrder(order);
      })
      .catch(() => {
        // Sem posições salvas ainda (endpoint pode nem existir no backend) — cascata padrão, editor continua usável.
        if (cancelled) return;
        const next: Record<string, ConvergiaFieldPosition> = {};
        const order: string[] = [];
        template.variables.forEach((variable, index) => {
          next[variable.name] = defaultPosition(variable.name, index);
          order.push(variable.name);
        });
        setPositions(next);
        setFieldOrder(order);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [template.id, template.variables]);

  function handleAddField() {
    const name = newFieldName.trim();
    if (!name || positions[name]) return;
    setPositions((current) => ({ ...current, [name]: defaultPosition(name, fieldOrder.length) }));
    setFieldOrder((current) => [...current, name]);
    setNewFieldName("");
    setSaved(false);
  }

  function handleRemoveField(name: string) {
    setPositions((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setFieldOrder((current) => current.filter((candidate) => candidate !== name));
    setSampleValues((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setSaved(false);
  }

  /** CONV-003 — estado local de preview, nunca chega em `saveConvergiaTemplatePositions`. */
  function updateSampleValue(name: string, value: string) {
    setSampleValues((current) => ({ ...current, [name]: value }));
  }

  function updateField(name: string, patch: Partial<ConvergiaFieldPosition>) {
    setPositions((current) => {
      const existing = current[name];
      if (!existing) return current;
      return { ...current, [name]: { ...existing, ...patch } };
    });
    setSaved(false);
  }

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
      await saveConvergiaTemplatePositions(template.id, fieldOrder.map((name) => positions[name]!));
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Falha ao salvar posições — endpoint de persistência ainda não existe em luna-core.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-xs text-muted-foreground">carregando posições…</p>;

  return (
    <div className="flex flex-col gap-2">
      {loadError && <p className="text-xs text-destructive">{loadError}</p>}
      <p className="text-xs text-muted-foreground">
        Arraste cada campo para posicioná-lo sobre o slide; use a alça no canto inferior direito da caixa para redimensionar.
      </p>

      <div className="flex items-center gap-2">
        <input
          value={newFieldName}
          onChange={(event) => setNewFieldName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAddField();
          }}
          placeholder="Nome do novo campo"
          className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="sm" variant="outline" onClick={handleAddField} disabled={!newFieldName.trim() || Boolean(positions[newFieldName.trim()])}>
          Adicionar campo
        </Button>
      </div>

      <div
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          containerType: "inline-size",
          ...aspectRatioStyle,
          ...(backgroundLoaded
            ? { backgroundImage: `url(${backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined),
        }}
        className={`relative w-full select-none overflow-hidden rounded border border-border bg-muted/30 ${aspectRatioStyle ? "" : "aspect-video"}`}
      >
        {/* Sonda de existência da imagem de fundo — não renderizada visualmente, só decide se o template tem uma. 404 (template pré-codificado, sem imagem) nunca dispara onLoad, o canvas continua com o fundo cinza padrão. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={backgroundImageUrl} alt="" className="hidden" onLoad={() => setBackgroundLoaded(true)} onError={() => setBackgroundLoaded(false)} />

        {fieldOrder.map((name) => {
          const position = positions[name];
          if (!position) return null;
          const variable = template.variables.find((candidate) => candidate.name === name);
          // CONV-003: preview só entra pra template visual, com valor de exemplo preenchido — senão, comportamento de sempre (mostra o nome do campo).
          const sampleValue = backgroundLoaded ? sampleValues[name]?.trim() : "";
          return (
            <div
              key={name}
              onPointerDown={(event) => handlePointerDown(event, name, "move")}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                width: `${position.width}%`,
                height: `${position.height}%`,
              }}
              className="absolute flex cursor-move flex-col justify-between rounded border border-primary/60 bg-primary/10 p-1 text-[10px] leading-tight text-foreground"
              title={variable?.description}
            >
              {sampleValue ? (
                <span
                  className="overflow-hidden leading-none"
                  style={{ fontSize: fontSizeToCqw(position.fontSize, slideWidthPt), fontFamily: position.fontFamily }}
                >
                  {sampleValue}
                </span>
              ) : (
                <span className="truncate font-medium">
                  {name}
                  {variable?.required && <span className="text-destructive"> *</span>}
                </span>
              )}
              <div
                onPointerDown={(event) => handlePointerDown(event, name, "resize")}
                className="ml-auto h-2.5 w-2.5 shrink-0 cursor-nwse-resize rounded-sm border border-primary bg-background"
              />
            </div>
          );
        })}
      </div>

      {backgroundLoaded && (
        <p className="text-[10px] italic text-muted-foreground">
          Preview em CSS, aproximado — não é o resultado real do PowerPoint (pixel-perfect fica pra uma etapa futura, ainda não decidida).
        </p>
      )}

      {fieldOrder.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum campo ainda — use &quot;Adicionar campo&quot; acima.</p>
      )}

      {fieldOrder.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-2">
          {fieldOrder.map((name) => {
            const position = positions[name];
            if (!position) return null;
            return (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 truncate font-medium">{name}</span>
                <label className="flex items-center gap-1 text-muted-foreground">
                  tamanho
                  <input
                    type="number"
                    min={6}
                    max={96}
                    value={position.fontSize}
                    onChange={(event) => updateField(name, { fontSize: clamp(Number(event.target.value) || CONVERGIA_DEFAULT_FONT_SIZE, 6, 96) })}
                    className="w-14 rounded border border-border bg-transparent px-1 py-0.5"
                  />
                </label>
                <label className="flex items-center gap-1 text-muted-foreground">
                  fonte
                  <select
                    value={position.fontFamily}
                    onChange={(event) => updateField(name, { fontFamily: event.target.value })}
                    className="rounded border border-border bg-transparent px-1 py-0.5 [color-scheme:dark]"
                  >
                    {CONVERGIA_SAFE_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </label>
                {backgroundLoaded && (
                  <input
                    value={sampleValues[name] ?? ""}
                    onChange={(event) => updateSampleValue(name, event.target.value)}
                    placeholder="valor de exemplo (preview)"
                    className="w-36 rounded border border-border bg-transparent px-1.5 py-0.5"
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveField(name)}
                  className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remover campo ${name}`}
                  title="Remover campo"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        {saved && !saveError && <p className="text-xs text-primary">Posições salvas.</p>}
        <Button size="sm" onClick={handleSave} disabled={saving || fieldOrder.length === 0}>
          {saving ? "Salvando…" : "Salvar posições"}
        </Button>
      </div>
    </div>
  );
}
