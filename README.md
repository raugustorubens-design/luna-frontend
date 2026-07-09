# luna-frontend

Frontend oficial da plataforma LUNA. Um único serviço Next.js com dois modos de operação:

- **User Mode** (`/`) — interface cinematográfica de observabilidade cognitiva. Pré-existente, inalterada nesta etapa.
- **Forge / Dev Mode** (`/forge`) — ambiente de engenharia da LUNA (Explorer, Editor, Chat, GitHub, Terminal, Contexto). Migrado do MVP-01 standalone (antes em `forge/` no monorepo `luna`), agora consolidado aqui como o lar definitivo do Forge.

O Modo Comercial (Projeto Renascer) será implementado em uma etapa futura.

## Arquitetura

- `app/` — rotas Next.js App Router (`/` = User Mode, `/forge` = Dev Mode, `/api/forge/git-status` = status git local).
- `components/` — componentes de UI. `components/forge/` são os componentes do Dev Mode (portados do MVP-01); os demais são do User Mode.
- `lib/forge/` — `api-client.ts` é o único ponto de contato com o organismo LUNA (Gateway `/gateway/execute`, `/gateway/capabilities`, `/api/chat`) — nunca acesso direto a banco/memória/providers. `git.ts` e `terminal-server.ts` são locais (checkout/terminal desta própria máquina, não uma capability do Gateway).
- `server.ts` — servidor customizado (Next.js + WebSocket no mesmo `http.Server`), necessário para o terminal do Forge funcionar dentro de um único serviço.

Ver `scripts/constitution-check.mjs` para a verificação automática dessas fronteiras, e `DEPLOY.md` para instruções de deploy no Railway.

## Desenvolvimento

```bash
pnpm install
pnpm run dev      # http://localhost:3000 (ou $PORT)
pnpm run typecheck
pnpm run test
pnpm run test:constitution
pnpm run build && pnpm run start
```

Variáveis de ambiente relevantes: ver `DEPLOY.md`.
