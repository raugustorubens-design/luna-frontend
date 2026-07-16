# Deploy — luna-frontend (User Mode + Forge Dev Mode)

Este serviço substitui `next start` por um servidor customizado (`server.ts`)
que também aceita conexões WebSocket em `/forge/terminal` — necessário para o
terminal do Forge funcionar dentro de um único serviço Railway.

## Passos no Railway

1. Conectar este repositório (`raugustorubens-design/luna-frontend`), branch
   `claude/forge-dev-mode` (ou `main`, após merge).
2. `railway.json` já define builder Nixpacks, `pnpm install && pnpm run build`
   como build command, e `pnpm run start` como start command — não deveria
   ser necessário configurar nada manualmente além das variáveis de ambiente
   abaixo.
3. Definir as variáveis de ambiente (Settings → Variables):

   | Variável | Valor | Obrigatória |
   |---|---|---|
   | `NEXT_PUBLIC_LUNA_API_BASE_URL` | URL pública do Cognitive Engine (monorepo `luna`, `apps/frontend/artifacts/api-server`), que serve `/api/chat` e `/api/context`, ex.: `https://strong-celebration-production.up.railway.app/api` | Sim — sem isso o Forge cai no default `http://localhost:3001/api`, que não existe em produção. **Nota (ADR-004, atualizada):** esse mesmo serviço Railway rodava um protótipo Vite órfão sem `/chat`/`/context` corretos, e foi erroneamente atribuído a um serviço `luna-guardian` na auditoria de Fase 1 — a causa real (`railway.json` quebrado no monorepo `luna`) foi corrigida em LUNA-001 (ver `luna_context/LUNA_CONTEXT.md` §16 nesse repo); o serviço agora serve o Cognitive Engine real |
   | `NEXT_PUBLIC_LUNA_GATEWAY_BASE_URL` | URL pública do Gateway, hoje `luna-core` (serviço `uvicorn-main`, projeto `honest-joy`), ex.: `https://uvicorn-main-production-92f8.up.railway.app/api` | Sim — sem isso o Forge cai no default `http://localhost:8080/api`, que não existe em produção. Separado de `NEXT_PUBLIC_LUNA_API_BASE_URL` desde o ADR-004: o Gateway foi portado para `luna-core`, um serviço diferente de onde `/chat`/`/context` respondem hoje |
   | `AUTH_GOOGLE_ID` | Client ID do OAuth do Google Cloud Console | Sim, para o login do `/forge` — ver "Autenticação do /forge" abaixo |
   | `AUTH_GOOGLE_SECRET` | Client Secret do mesmo OAuth client | Sim, junto com a anterior |
   | `AUTH_SECRET` | Um segredo gerado (`npx auth secret` ou `openssl rand -base64 33`) | Sim — o Auth.js recusa subir em produção sem isso |
   | `AUTH_URL` | URL pública deste serviço, ex.: `https://luna-frontend-production-ffcc.up.railway.app` | Sim — também é o que diz ao Auth.js para confiar no host do Railway (só confia automaticamente em domínios `*.vercel.app`) |
   | `FORGE_ALLOWED_EMAIL` | O único e-mail Google autorizado a entrar no `/forge` | Sim — **nunca** `NEXT_PUBLIC_*`. Sem essa variável, todo login é rejeitado (allowlist vazia nunca autoriza ninguém) |
   | `FORGE_TERMINAL_TOKEN` | Um segredo gerado por você (ex.: `openssl rand -hex 32`) | Sim, para o terminal funcionar — sem essa variável, o servidor rejeita toda conexão em `/forge/terminal` (nenhum shell é criado), mesmo com login Google válido. Ver "Segurança do terminal" abaixo |
   | `NEXT_PUBLIC_FORGE_TERMINAL_TOKEN` | **O mesmo valor** de `FORGE_TERMINAL_TOKEN` | Sim, junto com a anterior — é como o browser envia o token na conexão WebSocket |
   | `FORGE_WORKING_DIRECTORY` | Diretório de trabalho do terminal/git-status locais do Forge | Não — default é o próprio diretório do deploy (`process.cwd()`), que já é o correto |
   | `PORT` | — | Não — o Railway injeta automaticamente; `server.ts` já lê `process.env.PORT` |

4. Deploy. O healthcheck aponta para `/` (User Mode, estático).

## O que validar após o deploy

- `/` abre (User Mode) sem exigir login — continua público.
- `/forge` sem sessão redireciona para `/api/auth/signin` (não abre a UI).
- Login com a conta em `FORGE_ALLOWED_EMAIL` funciona e leva de volta ao
  `/forge` pedido (`callbackUrl`).
- Login com qualquer outra conta Google é rejeitado (`AccessDenied`) — não
  cria sessão.
- `/forge` abre (Dev Mode) sem erro 500 no console do navegador, já logado.
- Explorer lista arquivos (via Gateway `filesystem.list` — depende do backend
  configurado em `NEXT_PUBLIC_LUNA_GATEWAY_BASE_URL` estar no ar).
- Editor abre um arquivo real e salva (Cmd/Ctrl+S).
- Chat envia e recebe resposta real da LUNA, e a conversa é persistida via
  Hipocampo → Memory Engine → Supabase (depende de `NEXT_PUBLIC_LUNA_API_BASE_URL`
  apontando para o Cognitive Engine real — ver nota do ADR-004 acima).
- Painel GitHub lista branches/commits (depende de `github.list_branches`
  etc. estarem configurados com um token válido no backend — sem isso, o
  painel mostra um erro real do Gateway, não trava).
- Terminal conecta via WebSocket (`wss://<domínio>/forge/terminal`) e executa
  comandos reais.
- Painel de Contexto mostra branch/último commit reais (lidos do próprio
  checkout do deploy, via `/api/forge/git-status`).

## Autenticação do /forge (Google OAuth)

Todo o `/forge` (Explorer, Editor, chat, painel GitHub, terminal — tudo que
expõe capacidade via Gateway) exige login Google restrito a uma única conta,
via [Auth.js](https://authjs.dev) (`next-auth@5`). O Modo Usuário (`/`) não
muda em nada — continua público.

### Configurar o Google OAuth (uma vez, manual, no Google Cloud Console)

1. **APIs & Services → Credentials → OAuth consent screen**: tipo "External",
   publishing status **Testing** (não "In production") — evita a revisão de
   verificação do Google, desnecessária para uma ferramenta de um usuário só.
   Adicione seu e-mail em "Test users".
2. **Create Credentials → OAuth client ID**, tipo **Web application**.
3. **Authorized JavaScript origins**: a URL de produção (mesmo valor de
   `AUTH_URL`) e `http://localhost:3000` (dev local).
4. **Authorized redirect URIs**: `<AUTH_URL>/api/auth/callback/google` em
   produção, e `http://localhost:3000/api/auth/callback/google` em dev local.
5. Copiar o Client ID/Secret gerados para `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
   no Railway (tabela acima).

### Como a allowlist de um único e-mail é aplicada

`FORGE_ALLOWED_EMAIL` é verificada no callback `signIn` do Auth.js
(`auth.ts`) — um login com uma conta Google válida mas fora da allowlist é
**rejeitado de verdade** (nenhuma sessão/cookie é criada; Auth.js redireciona
para sua página de erro padrão, `AccessDenied`), não apenas "escondido" na
UI. A sessão em si vive num cookie `httpOnly` gerenciado pelo Auth.js — nunca
`localStorage`.

O middleware (`middleware.ts`) cobre `/forge/:path*` e `/api/forge/:path*`.
Em desenvolvimento local (`NODE_ENV !== "production"`) o gate é dispensado,
na mesma linha do próprio terminal — ambiente confiável, só o operador tem
acesso à porta.

### Terminal: dois controles, não um

O handshake do WebSocket do terminal (`/forge/terminal`) **não passa pelo
middleware do Next** — o `WebSocketServer` intercepta o upgrade direto no
`http.Server`, antes do request chegar no `handle()` do Next (ver
`server.ts`). Por isso `lib/forge/terminal-server.ts` refaz a checagem de
sessão ali mesmo, lendo o cookie do Auth.js diretamente via `getToken()`
(`next-auth/jwt`) — que não depende do contexto de requisição do Next, só de
`req.headers`.

Em produção, o terminal só conecta se **ambos** os controles passarem:

1. Sessão Google válida, com e-mail batendo `FORGE_ALLOWED_EMAIL` — a camada
   de autenticação de verdade.
2. Um token que bate com `FORGE_TERMINAL_TOKEN` — mantido como defesa em
   profundidade mesmo depois do login Google (achado original de revisão de
   código, anterior ao login Google: sem controle nenhum, qualquer um que
   alcançasse a URL pública ganhava um shell interativo). Sem essa variável
   configurada, o terminal fica desabilitado por padrão, mesmo com login
   válido.

O token, quando configurado, também é exposto ao client via
`NEXT_PUBLIC_FORGE_TERMINAL_TOKEN` (é como o browser o envia na conexão
WebSocket) — isso é seguro precisamente porque agora só um usuário
autenticado e autorizado (Google + allowlist) consegue carregar `/forge` e,
portanto, o bundle que contém esse token.

### Visão futura (registro de intenção — não implementado nesta mudança)

Hoje, um login Google fora da allowlist só recebe `AccessDenied`. A visão
futura é: usuários fora da allowlist veriam uma tela de apresentação do Forge
MVP e um fluxo de permissões — usando a infraestrutura do dono (Gateway,
Connector Hub), mas sem acesso aos arquivos/repositórios do dono, com
qualquer escrita em Supabase mediada pelo Guardian sob as regras de
armazenagem do dono. Isso é só um registro de intenção; não há desenho de
contrato, UI ou modelo de permissões ainda — não construir isso a partir
deste comentário sem um MVP próprio.

### Aviso de build inofensivo

`next build` pode logar avisos sobre `CompressionStream`/`DecompressionStream`
(de `jose`, usado pelo Auth.js) não suportados no Edge Runtime, na árvore de
import do `middleware.ts`. Esse caminho de código só existe para JWTs que
usam compressão (`zip` header) — o Auth.js nunca gera um; é código morto
sendo empacotado, não uma falha em produção. Confirmado lendo o código-fonte
do `@auth/core` antes de decidir não perseguir isso.

## Limitação conhecida deste ambiente de desenvolvimento

Esta sessão não tem acesso de rede a `railway.app` (política de rede do
sandbox bloqueia o domínio inteiro) nem um `RAILWAY_TOKEN` configurado — por
isso o deploy em si não pôde ser disparado nem verificado a partir daqui.
Este arquivo documenta o que falta configurar; a execução do deploy e a
validação em produção ficam para o passo manual no dashboard do Railway.
