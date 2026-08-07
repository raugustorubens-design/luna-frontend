# BUILDER.md

Autoatestação de builds feitos por sessões de IA (Engineer/Builder) neste repositório. Cada entrada declara, sem inflar, o que foi de fato verificado neste ambiente versus o que foi reportado mas não pôde ser confirmado aqui — nunca confirmar sucesso não verificado, mesmo quando é o que se espera ouvir. Mesmo padrão e mesmo princípio já em uso em `luna-core/BUILDER.md`.

---

## 2026-08-06 — Fix: `<select>` nativos ilegíveis no popup do menu (sem `color-scheme: dark` no elemento)

**Contexto:** conserto pequeno e isolado — CSS, sem lógica. Causa
identificada lendo o código (não reproduzida via captura de tela real do
usuário, mas confirmada pelo mecanismo): `<select>` nativos com
`bg-transparent` herdam o fundo escuro da página para o campo fechado,
mas o popup que abre ao clicar é desenhado pelo motor de renderização
nativo do navegador — que só honra o tema escuro de forma confiável
quando `color-scheme: dark` está declarado no próprio elemento, não
apenas herdado de um ancestral.

### O que foi entregue

`[color-scheme:dark]` (Tailwind, propriedade arbitrária) adicionado à
`className` dos 4 `<select>` nativos existentes no repositório inteiro
(confirmado via busca — não há outros):

- `components/forge/convergia-panel.tsx` — os dois identificados na
  instrução (`TransformStep`, `PositionStep`, campo "Template").
- `components/forge/forge-layout.tsx` — `ProjectSelector`.
- `components/forge/convergia-position-editor.tsx` — campo "fonte".

Não criado nenhum arquivo/mecanismo novo para isto: `app/globals.css` já
tem `:root { color-scheme: dark; }` (um lugar central já existia), mas
como está detalhado abaixo, isso sozinho não bastou — daí o ajuste por
elemento, exatamente como a instrução previa como plano B.

### Achado durante a verificação (relevante, leia antes de confiar nas capturas)

Tentei produzir uma captura antes/depois via Playwright (Chromium
headless, `/opt/pw-browsers/chromium`) abrindo o popup do
`ProjectSelector` (dados estáticos locais, não depende de rede — os
outros 3 selects dependem de templates vindos do backend, que não está
disponível neste ambiente). Resultado:

1. **A herança de `:root` já fazia `getComputedStyle(select).colorScheme`
   valer `"dark"` mesmo sem o fix** (`color-scheme` é propriedade
   herdada) — confirmado via `page.evaluate`. Isso por si só já é
   consistente com o relato original: a página *sabe* que é escura, mas
   o popup, por ser desenhado fora da árvore de renderização normal
   (widget de UI do navegador/SO, não DOM), pode não repassar a herança
   da mesma forma que qualquer outro elemento CSS repassaria — é
   justamente esse comportamento de exceção que a instrução descreve.
2. **Neste ambiente (Chromium headless em sandbox, sem display real),
   as capturas do popup aberto ficaram pixel-idênticas em três cenários
   testados: `color-scheme: dark` herdado do `:root`, `color-scheme:
   normal` (root removido temporariamente só para este teste, revertido
   antes do commit — não faz parte do diff) e com o fix aplicado por
   elemento.** Em todos os três, o popup renderizou com fundo
   branco/texto escuro para os itens não selecionados — não captei
   nenhuma versão "escura" do popup em nenhum dos três estados.

**Conclusão honesta:** não consegui, neste ambiente sandboxed, produzir
uma captura antes/depois que prove visualmente que o fix resolve o
sintoma relatado — Chromium headless não parece renderizar o popup
nativo de `<select>` com o tema real do SO/tela (é um widget de UI fora
do DOM, e headless não tem compositor de tela real por trás). Isso é
uma limitação conhecida de testar controles de formulário nativos em
modo headless, não uma falha do fix. O fix em si:

- é exatamente o que a instrução pediu (guard a mais, sem lógica nova);
- é a prática documentada correta (`color-scheme` no próprio elemento
  interativo, não só herdado, é a recomendação padrão para popups de
  `<select>`/`<input type=date>` etc. — herança de ancestral é
  historicamente pouco confiável para esses widgets específicos em
  vários motores/versões de navegador);
- não introduz regressão (`computed color-scheme` seguiu `"dark"` antes
  e depois — o fix não muda o comportamento herdado, só reforça no
  elemento).

Recomendo, se a prova visual for importante antes do merge, verificação
manual num navegador real (não headless) — algo que esta sessão não tem
como fazer.

### Verificado nesta sessão

- `npm run typecheck` — limpo.
- `npm run test:constitution` — `Constitution checks passed (46 files
  scanned)`.
- `npm test` — **24/24 passando** (suíte existente, nenhum teste novo
  específico deste fix — é CSS puro, sem lógica testável em
  `lib/forge/__tests__`).
- `getComputedStyle(select).colorScheme` confirmado `"dark"` nos 4
  selects após o fix (verificação de que a propriedade realmente chega
  ao elemento, via `page.evaluate` no Chromium real, não suposição).
- Capturas de tela produzidas (`before-project-selector.png`,
  `after-project-selector.png`, `truly-unstyled.png`) — mas, pelo motivo
  acima, não provam a diferença visual esperada neste ambiente. Não
  anexadas ao PR por não serem prova válida do fix (seria capturar
  "sucesso" que não foi de fato observado).

### O que NÃO foi feito

- Nenhuma troca de `<select>` nativo por componente customizado —
  decisão explícita de manter simples, respeitada.
- Nenhuma outra mudança nos arquivos além da classe `[color-scheme:dark]`
  nos 4 selects.
- `package-lock.json` gerado por `npm install` (repositório usa
  `pnpm-lock.yaml`, já commitado) — removido antes do commit, não faz
  parte deste PR.
- Merge, "Ready for review" — branch segue draft, aguardando revisão.

## 2026-08-07 — ADR-021 Fase 1: Wizard PWA de coleta de ronda (`/ronda`)

**Contexto:** superfície nova e separada do Forge (ADR-021, Decisão 1) —
não é uma aba dentro do Forge, é uma rota própria, mobile-first,
instalável como PWA, com fila offline. Escopo desta entrega: exatamente
a Fase 1 do ADR (wizard de coleta com fila offline e reenvio automático,
gravidade escolhida manualmente) — nada de Fase 2 em diante.

### O que foi entregue

- **`app/ronda/{layout,page}.tsx`** — rota própria, `manifest`/`viewport`/
  `apple-touch-icon` próprios (sobrescrevem os do layout raiz só nesta
  subárvore, sem afetar `/forge` nem o Modo Usuário).
  `components/mode-switcher.tsx` ajustado para também esconder o link
  "Dev Mode" em `/ronda` (mesma lógica que já esconde em `/forge`).
- **`public/ronda-manifest.json`** + **`public/ronda-icons/{icon-192,icon-512}.png`**
  (gerados por um encoder PNG mínimo escrito nesta sessão, sem dependência
  nova — `zlib` nativo do Node; ícone geométrico simples, arte
  placeholder, não deliverable de design) — `start_url: "/ronda"`,
  `display: "standalone"`, ícones `any`+`maskable` nos dois tamanhos.
- **`public/ronda-sw.js`** — service worker escrito à mão (sem
  workbox/next-pwa, nenhuma das duas é dependência deste projeto hoje):
  cache do app shell (navegação network-first com fallback pra cache;
  assets cache-first com atualização em segundo plano), escopo restrito
  a `/ronda` no registro. Nunca intercepta `POST` — o envio da ronda
  sempre vai direto à rede; a fila offline é responsabilidade separada
  (IndexedDB), não cache HTTP.
- **`lib/ronda/`** — `types.ts` (mesmo modelo canônico de
  `luna-core/src/convergia/ronda/contracts.ts`, cópia deliberada, não
  import cross-repo), `db.ts` (fila em IndexedDB nativo, sem lib nova),
  `queue.ts` (reenvio automático no evento `online` + na reabertura do
  app, um item de cada vez, uma falha não aborta o resto da fila),
  `api-client.ts` (`POST /convergia/ronda`), `photo.ts` (compressão
  client-side via canvas — redimensiona pro lado maior até 1280px,
  recomprime JPEG qualidade 0.7, antes de guardar/enviar — câmera nativa
  de celular real produz fotos de vários MB, inviáveis pra IndexedDB e
  pro payload JSON em rede de campo ruim), `use-ronda-queue.ts` (hook
  reativo pra contagem pendente/confirmado).
- **`components/ronda/`** — `ronda-wizard.tsx` (orquestrador dos 3
  blocos), `finding-card.tsx` (um card por categoria de risco, seletor de
  estado de 3 opções, formulário do achado só aparece quando
  "identificado" — foto nunca obrigatória, campo de texto nativo
  `<textarea>` sem componente customizado, pra não bloquear o teclado
  nativo/ditado por voz), `queue-status-bar.tsx` (contagem visível de
  pendente/enviando/confirmado/falhou, nunca silencioso),
  `register-service-worker.tsx`.
- **`lib/forge/api-client.ts`** — `LUNA_GATEWAY_BASE_URL` exportado (era
  `const` privado) pra `lib/ronda/api-client.ts` reaproveitar a mesma
  resolução de base URL em vez de duplicá-la.

### Verificado nesta sessão

- `npm run typecheck` — limpo.
- `npm run test:constitution` — `Constitution checks passed (60 files
  scanned)`.
- `npm test` — **30/30** (glob do script `test` em `package.json`
  ampliado pra incluir `lib/ronda/__tests__/*.test.ts`, que antes não
  rodava nada fora de `lib/forge/__tests__`). 6 testes novos, lógica pura
  extraída pra ser testável sem DOM/IndexedDB: `metadataComplete`
  (`types.test.ts`), `pendingCategories` (`types.test.ts`),
  `summarizeQueue` (`db.test.ts`). **Nota sobre um teste pré-existente,
  não relacionado a esta entrega:** `lib/forge/__tests__/git.test.ts`
  ("readLocalGitStatus reports the current branch...") falhou de forma
  intermitente nesta sessão com `signing server returned status 503` —
  confirmei que é um flake do serviço de assinatura de commit deste
  sandbox, não algo que esta entrega introduziu, revertendo todas as
  mudanças (`git stash`) e rodando só esse teste isolado: falhou do mesmo
  jeito, sem nenhuma mudança minha aplicada.
- **Verificação funcional real, via Playwright contra o servidor de
  desenvolvimento local (`npm run dev`), não suposição:**
  - Manifest: `<link rel="manifest">` aponta pro `ronda-manifest.json`
    real, que responde com `name`/`start_url: "/ronda"`/
    `display: "standalone"`/ícones 192×192 e 512×512 — os dois PNGs
    realmente respondem `image/png`. `apple-touch-icon` e `theme-color`
    presentes (instalabilidade iOS).
  - Service worker: `navigator.serviceWorker.getRegistration("/ronda")`
    confirma registro ativo, `scope` restrito a `/ronda`.
  - Wizard preenchido de ponta a ponta com dado sintético real: Bloco A
    completo; Bloco B com as 7 categorias — 6 marcadas "considerado
    inexistente", 1 marcada "identificado" com uma foto real (JPEG
    genuíno decodificável, não um mock) enviada via
    `input[type=file].setInputFiles`, exercitando de verdade o caminho
    `compressPhoto()` (decode via `<canvas>`, redimensiona, recomprime)
    — a miniatura comprimida aparece no card, confirmando que o
    pipeline de foto funciona ponta a ponta, não só que o arquivo foi
    aceito.
  - **Teste de modo avião real:** `browserContext.setOffline(true)`
    *antes* de clicar "Concluir ronda". Confirmado via leitura direta do
    IndexedDB (`indexedDB.open("luna-ronda")`) que a ronda ficou salva
    localmente com `status: "pending"` — e a barra de status na tela
    mostrou "1 pendente" (nunca silencioso, como o ADR exige).
  - **Reenvio automático:** sem backend `luna-core` real alcançável
    neste sandbox, interceptei `POST /convergia/ronda` via
    `page.route()` (devolvendo o mesmo shape de resposta que o PR irmão
    do `luna-core`, `#35`, realmente devolve — `{ronda: {rondaId, ...}}`)
    — não fingi que testei contra o backend real, deixei isso explícito.
    Reconectei (`setOffline(false)`) e disparei o evento `online`
    (`window.dispatchEvent(new Event("online"))`, mesmo evento que
    `registerAutoSync` escuta em produção) **sem nenhuma ação manual
    além disso** — confirmado via IndexedDB que o item mudou pra
    `status: "synced"` com o `rondaId` do servidor, e a barra de status
    passou a mostrar "1 confirmada no servidor".
  - **Gate de conclusão (ADR-021 "não avaliado bloqueia a conclusão"):**
    testado deixando 1 de 7 categorias sem avaliar — confirmado que o
    botão "Concluir ronda" fica desabilitado (`isDisabled() === true`) e
    que o aviso na tela lista corretamente a categoria pendente certa
    ("Máquinas e Equipamentos"), não uma genérica.
  - Capturas de tela reais anexadas ao PR (Bloco B preenchido, tela de
    gate bloqueado, tela final "Ronda salva... já confirmada no
    servidor").

### O que NÃO foi feito (fora de escopo desta fase, por instrução explícita)

- Geração de relatório PPT — Fase 2.
- Qualquer separação sensível/lógica ou persistência em `memoria_luna` —
  Fase 3.
- Leitura de imagem por IA, gravidade sugerida, tokenização de
  cliente/local — Fase 4.
- PDF/BI — Fase 5.
- Teste de instalação PWA num dispositivo Android/iOS real — verificado
  só via os critérios técnicos de instalabilidade (manifest válido,
  ícones corretos, service worker ativo, `apple-touch-icon` presente),
  não via o prompt real "adicionar à tela inicial" de um navegador móvel
  de verdade, que este sandbox não tem como abrir.
- Verificação contra o backend `luna-core` real — o PR irmão
  (`raugustorubens-design/luna-core#35`) ainda está em revisão; o reenvio
  automático foi verificado com o `POST /convergia/ronda` interceptado
  (mockado com o shape real de resposta), não contra o Guardian de
  produção.
- Merge, "Ready for review" — branch segue draft, aguardando revisão.
