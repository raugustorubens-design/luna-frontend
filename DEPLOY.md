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
   | `NEXT_PUBLIC_LUNA_API_BASE_URL` | URL pública do backend LUNA (Gateway + `/api/chat`), ex.: `https://strong-celebration-production.up.railway.app/api` | Sim — sem isso o Forge cai no default `http://localhost:3001/api`, que não existe em produção |
   | `FORGE_WORKING_DIRECTORY` | Diretório de trabalho do terminal/git-status locais do Forge | Não — default é o próprio diretório do deploy (`process.cwd()`), que já é o correto |
   | `PORT` | — | Não — o Railway injeta automaticamente; `server.ts` já lê `process.env.PORT` |

4. Deploy. O healthcheck aponta para `/` (User Mode, estático).

## O que validar após o deploy

- `/` abre (User Mode).
- `/forge` abre (Dev Mode) sem erro 500 no console do navegador.
- Explorer lista arquivos (via Gateway `filesystem.list` — depende do backend
  configurado em `NEXT_PUBLIC_LUNA_API_BASE_URL` estar no ar).
- Editor abre um arquivo real e salva (Cmd/Ctrl+S).
- Chat envia e recebe resposta real da LUNA.
- Painel GitHub lista branches/commits (depende de `github.list_branches`
  etc. estarem configurados com um token válido no backend — sem isso, o
  painel mostra um erro real do Gateway, não trava).
- Terminal conecta via WebSocket (`wss://<domínio>/forge/terminal`) e executa
  comandos reais.
- Painel de Contexto mostra branch/último commit reais (lidos do próprio
  checkout do deploy, via `/api/forge/git-status`).

## Limitação conhecida deste ambiente de desenvolvimento

Esta sessão não tem acesso de rede a `railway.app` (política de rede do
sandbox bloqueia o domínio inteiro) nem um `RAILWAY_TOKEN` configurado — por
isso o deploy em si não pôde ser disparado nem verificado a partir daqui.
Este arquivo documenta o que falta configurar; a execução do deploy e a
validação em produção ficam para o passo manual no dashboard do Railway.
