"use client";

// Portado de forge/apps/web/src/components/chat/Chat.tsx (monorepo `luna`).
import { useState } from "react";
import { Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { sendChatMessage, type ChatMessage } from "@/lib/forge/api-client";
import { cn } from "@/lib/forge/utils";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  error?: boolean;
}

export function Chat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content }, { role: "assistant", content: "…", pending: true }]);
    setSending(true);

    try {
      const reply: ChatMessage = await sendChatMessage(content, conversationId);
      setConversationId(reply.conversationId);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: reply.content };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: err instanceof Error ? err.message : "Erro ao falar com a LUNA.",
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
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chat da LUNA</div>
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-2 py-2">
          {messages.length === 0 && <p className="text-sm text-muted-foreground">Converse com a LUNA. Ela decide, sozinha, qual provider responde.</p>}
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                message.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted",
                message.error && "border border-destructive text-destructive",
              )}
            >
              {message.content}
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
          placeholder="Fale com a LUNA…"
          className="flex-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="icon" onClick={handleSend} disabled={sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
