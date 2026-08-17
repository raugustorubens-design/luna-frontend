import { Chat } from "@/components/forge/chat";

/**
 * ADR-022, Forge v2 — o Chat sai da faixa horizontal de 20% de altura
 * (empilhada com Explorer/Editor e Contexto/Git/Terminal, ver
 * `forge-layout.tsx`) e ganha coluna própria à direita, na largura inteira
 * da tela. É a mudança que este pacote existe para fazer: o Chat só crescia
 * antes roubando altura do editor.
 *
 * `Chat` em si não muda — mesmo componente, mesma assinatura, só de casa
 * nova.
 */
export function ChatColumn() {
  return (
    <div className="flex h-full min-h-0 flex-col border-l border-[var(--luna-line-2)] bg-[var(--luna-surface)]">
      <Chat />
    </div>
  );
}
