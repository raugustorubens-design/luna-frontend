"use client";

// Convergia (ADR-012 Decisão 2) — nova área do Forge, mesmo padrão visual/
// estrutural de components/forge/ (Tabs, ScrollArea, Button, classes
// utilitárias cruas, sem componente de UI extra). Fluxo: upload de arquivo
// -> catálogo -> upload de treinamento/conhecimento -> transformação.
import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchConvergiaCatalog,
  fetchConvergiaTemplates,
  parseConvergiaFile,
  submitConvergiaTraining,
  transformConvergiaFile,
  uploadConvergiaVisualTemplate,
  type ConvergiaCatalogEntry,
  type ConvergiaParseResult,
  type ConvergiaTemplateSummary,
  type ConvergiaTrainingResult,
} from "@/lib/forge/api-client";
import { ConvergiaPositionEditor } from "@/components/forge/convergia-position-editor";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{children}</div>;
}

/**
 * Reorganização de apresentação do catálogo (correção de escopo do
 * Rubens: os 13 tipos continuam existindo, têm função futura — ADR-012,
 * conteúdo alimentado depois via `POST /convergia/training` — a lista
 * só estava ilegível). Nada de backend muda: `CORPORATE_DOCUMENT_CATALOG`
 * e `/convergia/catalog` seguem intactos, isto é só a forma de exibir o
 * mesmo dado. Rótulo legível por categoria, para o cabeçalho de grupo em
 * vez da tag solta ao lado de cada item.
 */
const CATALOG_CATEGORY_LABELS: Record<ConvergiaCatalogEntry["category"], string> = {
  apresentacao: "Apresentação",
  gerencial: "Gerencial",
  ssma: "SSMA",
};

function groupCatalogByCategory(catalog: ConvergiaCatalogEntry[]): Array<[string, ConvergiaCatalogEntry[]]> {
  const groups = new Map<ConvergiaCatalogEntry["category"], ConvergiaCatalogEntry[]>();
  for (const entry of catalog) {
    const group = groups.get(entry.category) ?? [];
    group.push(entry);
    groups.set(entry.category, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }
  return [...groups.entries()]
    .map(([category, entries]) => [CATALOG_CATEGORY_LABELS[category], entries] as [string, ConvergiaCatalogEntry[]])
    .sort(([labelA], [labelB]) => labelA.localeCompare(labelB, "pt-BR"));
}

/** Etapas 1+2 — upload de arquivo e catálogo de tipos de documento (referência, template ainda não aplicado). */
function CatalogAndUploadStep({
  onParsed,
}: {
  onParsed: (file: File, result: ConvergiaParseResult) => void;
}) {
  const [catalog, setCatalog] = useState<ConvergiaCatalogEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConvergiaCatalog()
      .then(setCatalog)
      .catch((err) => setCatalogError(err instanceof Error ? err.message : "Falha ao consultar o catálogo do Convergia"));
  }, []);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseConvergiaFile(file);
      onParsed(file, result);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Falha ao processar o arquivo.");
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionLabel>1. Upload de arquivo (xlsx, csv, json)</SectionLabel>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv,.json"
            onChange={handleFileChange}
            className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
          />
          {parsing && <span className="text-xs text-muted-foreground">processando…</span>}
        </div>
        {fileName && !parsing && !parseError && (
          <p className="mt-1 text-xs text-muted-foreground">{fileName} — modelo canônico gerado, ver aba Transformação.</p>
        )}
        {parseError && <p className="mt-1 text-xs text-destructive">{parseError}</p>}
      </div>

      <div className="border-t pt-3">
        <SectionLabel>2. Catálogo de documentos corporativos</SectionLabel>
        <p className="mb-2 text-[10px] text-muted-foreground">
          Tipos de documento planejados (conteúdo alimentado depois pelo especialista) — referência, não clicável, ainda não são templates prontos para usar.
        </p>
        {catalogError && <p className="text-xs text-destructive">{catalogError}</p>}
        {!catalogError && catalog === null && <p className="text-xs text-muted-foreground">…</p>}
        {catalog && (
          <div className="flex flex-col gap-3">
            {groupCatalogByCategory(catalog).map(([categoryLabel, entries]) => (
              <div key={categoryLabel}>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground">{categoryLabel}</div>
                <ul className="flex flex-col divide-y divide-border/60 rounded border border-border/60">
                  {entries.map((entry) => (
                    <li key={entry.id} className="px-2 py-1 text-xs">
                      {entry.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * CONV-001 — upload de imagem de fundo para um template visual novo.
 * Aba própria, separada de "Catálogo & Upload" de propósito (instrução
 * explícita): "subir dados pra transformar" (arquivo xlsx/csv/json,
 * etapa 1) e "subir imagem de template" (uma imagem, vira template) são
 * dois fluxos diferentes — misturar os dois no mesmo formulário confundiria
 * qual arquivo faz o quê.
 */
function VisualTemplateUploadStep() {
  const [name, setName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedTemplateId, setUploadedTemplateId] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !name.trim()) return;
    setUploading(true);
    setError(null);
    setUploadedTemplateId(null);
    try {
      const result = await uploadConvergiaVisualTemplate(name.trim(), file);
      setUploadedTemplateId(result.templateId);
      setName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar o template visual.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <SectionLabel>Template visual — imagem de fundo (PNG/JPG)</SectionLabel>
        <p className="mb-2 text-xs text-muted-foreground">
          Envie a imagem do certificado/documento real (ex. Manserv/SMX). Depois, use a aba Posicionamento para arrastar campos por cima dela.
        </p>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome do template (ex. Certificado Manserv)"
          className="mb-2 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleUpload} disabled={uploading || !name.trim()}>
            {uploading ? "Enviando…" : "Enviar imagem"}
          </Button>
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        {uploadedTemplateId && (
          <p className="mt-1 text-xs text-primary">
            Template criado ({uploadedTemplateId}) — vá para a aba Posicionamento para adicionar campos.
          </p>
        )}
      </div>
    </div>
  );
}

/** Etapa 3 — upload de treinamento/conhecimento em texto (Hipocampo decide consolidar ou descartar cada tipo). */
function TrainingStep() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvergiaTrainingResult | null>(null);

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      setResult(await submitConvergiaTraining(title.trim(), content));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar treinamento para a memória.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <SectionLabel>3. Upload de treinamento/conhecimento</SectionLabel>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Título do treinamento"
          className="mb-2 w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Cole aqui o conteúdo de treinamento (markdown: use # títulos, listas e passos numerados — a extração de conceitos/procedimentos é determinística sobre essa estrutura)"
          rows={8}
          className="w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !title.trim() || !content.trim()}>
            {submitting ? "Enviando…" : "Enviar para a memória"}
          </Button>
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>

      {result && (
        <div className="border-t pt-3 text-xs">
          <SectionLabel>Extração (Hipocampo)</SectionLabel>
          {result.extraction.concepts.length > 0 && (
            <p className="truncate"><span className="text-muted-foreground">Conceitos:</span> {result.extraction.concepts.join(", ")}</p>
          )}
          {result.extraction.procedures.length > 0 && (
            <p className="truncate"><span className="text-muted-foreground">Procedimentos:</span> {result.extraction.procedures.join(", ")}</p>
          )}
          {result.extraction.inferences.length > 0 && (
            <p className="truncate"><span className="text-muted-foreground">Inferências:</span> {result.extraction.inferences.join(", ")}</p>
          )}
          <div className="mt-2 flex flex-col gap-0.5">
            {(["semantica", "procedimental", "inferencial"] as const).map((tipo) => {
              const decision = result.decisions[tipo];
              if (!decision) return null;
              return (
                <p key={tipo}>
                  <span className="text-muted-foreground">{tipo}:</span>{" "}
                  <span className={decision.action === "consolidate" ? "text-primary" : "text-muted-foreground"}>
                    {decision.action}
                  </span>{" "}
                  <span className="text-muted-foreground">({decision.reason})</span>
                </p>
              );
            })}
            {!result.decisions.semantica && !result.decisions.procedimental && !result.decisions.inferencial && (
              <p className="text-muted-foreground">Nada consolidado — nenhum conceito/procedimento/inferência extraído.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Etapa 4 — transformação: aplica um template ao arquivo já enviado e baixa o resultado renderizado. */
function TransformStep({ file, parseResult }: { file: File | null; parseResult: ConvergiaParseResult | null }) {
  const [templates, setTemplates] = useState<ConvergiaTemplateSummary[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [persistAsKnowledge, setPersistAsKnowledge] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchConvergiaTemplates()
      .then((list) => {
        setTemplates(list);
        if (list.length > 0) setTemplateId((current) => current || list[0]!.id);
      })
      .catch((err) => setTemplatesError(err instanceof Error ? err.message : "Falha ao consultar templates do Convergia"));
  }, []);

  async function handleTransform() {
    if (!file || !templateId) return;
    setTransforming(true);
    setTransformError(null);
    setDone(false);
    try {
      const result = await transformConvergiaFile({ file, templateId, persistAsKnowledge });
      setWarnings(result.warnings);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (err) {
      setTransformError(err instanceof Error ? err.message : "Falha ao transformar o documento.");
    } finally {
      setTransforming(false);
    }
  }

  if (!file || !parseResult) {
    return <p className="text-xs text-muted-foreground">Envie um arquivo na aba Catálogo/Upload primeiro.</p>;
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div>
        <SectionLabel>Modelo canônico ({file.name})</SectionLabel>
        <p className="text-muted-foreground">
          {parseResult.document.metadata.recordCount} registro(s) · colunas: {parseResult.document.columns.join(", ")}
        </p>
        {!parseResult.validation.valid && (
          <ul className="mt-1 list-inside list-disc text-destructive">
            {parseResult.validation.issues.map((issue, index) => (
              <li key={index}>{issue.path}: {issue.message}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t pt-3">
        <SectionLabel>4. Template de transformação</SectionLabel>
        {templatesError && <p className="text-destructive">{templatesError}</p>}
        {!templatesError && templates === null && <p className="text-muted-foreground">…</p>}
        {templates && templates.length === 0 && <p className="text-muted-foreground">nenhum template registrado</p>}
        {templates && templates.length > 0 && (
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs"
          >
            {templates.map((template) => (
              <option key={`${template.id}-v${template.version}`} value={template.id}>
                {template.id} (v{template.version}, {template.renderer}) — {template.metadata.description}
              </option>
            ))}
          </select>
        )}

        <label className="mt-2 flex items-center gap-1.5 text-muted-foreground">
          <input type="checkbox" checked={persistAsKnowledge} onChange={(event) => setPersistAsKnowledge(event.target.checked)} />
          Enviar resultado como conhecimento ao Guardian (via Hipocampo)
        </label>

        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleTransform} disabled={transforming || !templateId}>
            {transforming ? "Transformando…" : "Transformar e baixar"}
          </Button>
        </div>

        {transformError && <p className="mt-1 text-destructive">{transformError}</p>}
        {done && <p className="mt-1 text-primary">Download iniciado.</p>}
        {warnings.length > 0 && (
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Etapa avulsa (CONV-002) — edição da posição de cada campo sobre o slide, por template. Independente do arquivo enviado nas etapas 1/4. */
function PositionStep() {
  const [templates, setTemplates] = useState<ConvergiaTemplateSummary[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");

  useEffect(() => {
    fetchConvergiaTemplates()
      .then((list) => {
        setTemplates(list);
        if (list.length > 0) setTemplateId((current) => current || list[0]!.id);
      })
      .catch((err) => setTemplatesError(err instanceof Error ? err.message : "Falha ao consultar templates do Convergia"));
  }, []);

  const selected = templates?.find((template) => template.id === templateId) ?? null;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div>
        <SectionLabel>Template</SectionLabel>
        {templatesError && <p className="text-destructive">{templatesError}</p>}
        {!templatesError && templates === null && <p className="text-muted-foreground">…</p>}
        {templates && templates.length === 0 && <p className="text-muted-foreground">nenhum template registrado</p>}
        {templates && templates.length > 0 && (
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs"
          >
            {templates.map((template) => (
              <option key={`${template.id}-v${template.version}`} value={template.id}>
                {template.id} (v{template.version}, {template.renderer}) — {template.metadata.description}
              </option>
            ))}
          </select>
        )}
      </div>

      {selected && (
        <div className="border-t pt-3">
          <SectionLabel>Posicionamento de campos ({selected.id})</SectionLabel>
          <ConvergiaPositionEditor key={selected.id} template={selected} />
        </div>
      )}
    </div>
  );
}

export function ConvergiaPanel() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ConvergiaParseResult | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Convergia — transformação de conhecimento
      </div>
      <Tabs defaultValue="upload" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-3 w-fit justify-start">
          <TabsTrigger value="upload">Catálogo &amp; Upload</TabsTrigger>
          <TabsTrigger value="visual-template">Template Visual</TabsTrigger>
          <TabsTrigger value="positioning">Posicionamento</TabsTrigger>
          <TabsTrigger value="transform">Transformação</TabsTrigger>
          <TabsTrigger value="training">Conhecimento</TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full px-3 pb-3">
            <CatalogAndUploadStep
              onParsed={(file, result) => {
                setUploadedFile(file);
                setParseResult(result);
              }}
            />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="visual-template" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full px-3 pb-3">
            <VisualTemplateUploadStep />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="positioning" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full px-3 pb-3">
            <PositionStep />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="transform" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full px-3 pb-3">
            <TransformStep file={uploadedFile} parseResult={parseResult} />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="training" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full px-3 pb-3">
            <TrainingStep />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
