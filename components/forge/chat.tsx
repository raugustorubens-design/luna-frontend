"use client";

// Portado de forge/apps/web/src/components/chat/Chat.tsx (monorepo `luna`).
import { useState } from "react";
import { Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { sendChatMessage, type ChatMessage } from "@/lib/forge/api-client";
import { cn } from "@/lib/forge/utils";
import { FORGE_AGENTS, FORGE_AGENT_LABELS, FORGE_AGENT_DEFAULT_MODEL, type ForgeAgent, type MessageAttribution } from "@/lib/forge/attribution";
import { useForgeProject } from "@/lib/forge/project-context";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  attribution: MessageAttribution;
  pending?: boolean;
  error?: boolean;
}

function makeAttribution(agent: ForgeAgent, projectId: string): MessageAttribution {
  return {
    agent,
    model: FORGE_AGENT_DEFAULT_MODEL[agent],
    timestamp: new Date().toISOString(),
    projectId,
  };
}

export function Chat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  // FORGE-MVP-02: um agente ativo por vez em v0.1 — v0.2 troca isto por
  // múltiplos agentes concorrentes, sem mudar o modelo de atribuição.
  const [activeAgent, setActiveAgent] = useState<ForgeAgent>("claude");
  // FORGE-MVP-03: projeto ativo, compartilhado com o resto do Forge via
  // ProjectProvider (ver forge-layout.tsx) — substitui o default fixo que
  // existia aqui antes deste MVP.
  const { project } = useForgeProject();

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content, attribution: makeAttribution(activeAgent, project) },
      { role: "assistant", content: "…", attribution: makeAttribution(activeAgent, project), pending: true },
    ]);
    setSending(true);

    try {
      const reply: ChatMessage = await sendChatMessage(content, conversationId, {
        agent: activeAgent,
        model: FORGE_AGENT_DEFAULT_MODEL[activeAgent],
      });
      setConversationId(reply.conversationId);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: reply.content, attribution: makeAttribution(activeAgent, project) };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: err instanceof Error ? err.message : "Erro ao falar com a LUNA.",
          attribution: makeAttribution(activeAgent, project),
          error: true,
        };
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chat da LUNA</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Agente ativo">
          {FORGE_AGENTS.map((agent) => (
            <button
              key={agent}
              type="button"
              role="radio"
              aria-checked={activeAgent === agent}
              onClick={() => setActiveAgent(agent)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                activeAgent === agent ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
              title={`Falar com ${FORGE_AGENT_LABELS[agent]}`}
            >
              {FORGE_AGENT_LABELS[agent]}
            </button>
          ))}
        </div>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-2 py-2">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">Escolha um agente acima e converse. Toda mensagem fica atribuída a ele.</p>
          )}
          {messages.map((message, index) => (
            <div key={index} className={cn("flex flex-col gap-0.5", message.role === "user" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  message.error && "border border-destructive text-destructive",
                )}
              >
                {message.content}
              </div>
              <span className="px-1 text-[10px] text-muted-foreground">
                {FORGE_AGENT_LABELS[message.attribution.agent]} · {message.attribution.model} ·{" "}
                {new Date(message.attribution.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="flex items-center gap-2 border-t p-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Fale com ${FORGE_AGENT_LABELS[activeAgent]}…`}
          className="flex-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="icon" onClick={handleSend} disabled={sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
