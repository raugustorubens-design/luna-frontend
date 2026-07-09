# Roadmap do LUNA Forge (Dev Mode)

Cada item abaixo é um MVP futuro independente — nenhum implementado nesta etapa. Portado de `forge/ROADMAP.md` (monorepo `luna`) na consolidação do Forge MVP-01 como Dev Mode do luna-frontend.

## Forge MVP-02 — Context Hub
- Expor um endpoint HTTP real para o Context Hub (`GET /api/context`), hoje só uma função interna do Cognitive Engine.
- Painel de Contexto do Forge passa a consumir esse endpoint em vez de parsear `LUNA_CONTEXT.md` diretamente.

## Forge MVP-03 — Git Inteligente
- Merge de pull request (capability `github.merge_pull_request` não existe hoje no Gateway — pré-requisito).
- Review/aprovação de PR (capability equivalente também não existe).
- Diff visual lado a lado (Monaco diff editor) em vez do texto unificado simples do MVP-01.

## Forge MVP-04 — Provider Router
- Painel de seleção/observação de qual provider está sendo usado por conversa (hoje é opaco ao Forge, por desenho).
- Consumo de métricas do Budget Manager.

## Forge MVP-05 — Python Workspace
- Ambientes virtuais, execução de script, depuração, notebooks, bibliotecas.
- Ver `ARCHITECTURE.md` §Python para a direção arquitetural já registrada.

## Forge MVP-06 — Observabilidade
- Consumir o Reporter oficial (`Luna-reporter`, repositório próprio) para exibir saúde do ecossistema dentro do Forge.
- Consumir o log de auditoria interno do Cognitive Engine (`src/luna/reporter.ts` no monorepo) como fonte complementar.

## Forge MVP-07 — Diagnóstico Arquitetural
- Rodar `architecture-check.mjs` (e equivalentes de outros sistemas) a partir do Forge, com resultado visual.

## Forge MVP-08 — Engenharia Cognitiva
- Painel para inspecionar o pipeline cognitivo em execução (estágios, timings, decisões do Hipocampo) — dependente do Reporter interno virar consultável via API.

## Forge MVP-09 — Pair Programming
- Colaboração em tempo real entre desenvolvedor e LUNA no mesmo arquivo (edição assistida, não apenas chat).

## Forge MVP-10 — Multiagentes
- Orquestração de múltiplos agentes de desenvolvimento dentro do Forge — depende do Planner (ainda sem responsabilidade definida no organismo) e do Provider Router (MVP-04).

## Pendências técnicas registradas nesta etapa (fora dos MVPs de produto)

- ~~Migrar `forge/` de dentro do monorepo `luna` para o repositório próprio `raugustorubens-design/luna-forge`~~ — **resolvido de forma diferente da prevista**: consolidado em `raugustorubens-design/luna-frontend` (`/forge`, branch `claude/forge-dev-mode`) em vez de um repositório `luna-forge` dedicado. Este roadmap agora vive em `luna-frontend` também; os itens abaixo continuam válidos, só o repositório de destino mudou.
- Capability `github.merge_pull_request` e capability de review de PR não existem no Gateway — bloqueiam MVP-03.
- Endpoint HTTP do Context Hub não existe — bloqueia a versão definitiva do painel de Contexto (MVP-02).
