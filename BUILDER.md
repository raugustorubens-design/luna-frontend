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

## 2026-08-07 — Fix: editor de posicionamento (CONV-001/002) usava régua de slide fixa (720pt, 16:9), não a proporção real da imagem do template

**Contexto:** metade `luna-frontend` de um fix ponta a ponta — o par
`luna-core` (render + upload) sai num PR irmão nesse repositório, os dois
são necessários juntos para o comportamento ficar correto. Diagnóstico
já fechado antes desta sessão (não redescoberto aqui, ver PR irmão):
o slide de um template visual sempre nascia 16:9 fixo no `luna-core`, e
`slide.background` esticava a imagem de fundo pra cobrir esse tamanho —
uma carteirinha (proporção bem diferente de 16:9) saía distorcida no
`.pptx` final. Consequência aqui: `SLIDE_WIDTH_PT = 720` estava
hardcoded em `convergia-position-editor.tsx`, e o canvas usava
`aspect-video` (16:9 fixo) — então mesmo depois do fix do `luna-core`, o
editor continuaria mostrando/calculando com a régua errada.

### O que foi entregue

1. **`lib/forge/api-client.ts`**: `ConvergiaTemplateSummary.slideSize?: {
   widthPt, heightPt }` — novo campo opcional, espelhando o que
   `GET /convergia/templates` do `luna-core` agora expõe por template
   visual com dimensão de imagem conhecida. `undefined` para templates
   pré-codificados e para templates visuais enviados antes do fix (sem
   dimensão salva) — tratado como "regra ainda não disponível", nunca
   como erro.
2. **`convergia-position-editor.tsx`**:
   - `SLIDE_WIDTH_PT` (constante fixa, 720) virou
     `SLIDE_WIDTH_PT_FALLBACK` — só usada quando `template.slideSize`
     não existe. A largura real (`slideWidthPt`) agora vem de
     `template.slideSize?.widthPt ?? SLIDE_WIDTH_PT_FALLBACK`.
   - `fontSizeToCqw` passou a receber a largura do slide como parâmetro
     em vez de ler a constante do módulo — **a fórmula em si não
     mudou** (`(fontSize / larguraDoSlide) * 100` unidades de `cqw`),
     só a fonte do número, exatamente como pedido.
   - O canvas trocou `aspect-video` (classe fixa) por
     `style={{ aspectRatio: "${widthPt} / ${heightPt}" }}` quando o
     template tem imagem de fundo carregada (`backgroundLoaded`) **e**
     `slideSize` conhecido; `aspect-video` continua como fallback via
     className nos outros dois casos (sem imagem, ou template sem
     dimensão salva) — mesmo espírito do item 5 do PR irmão no
     `luna-core`, não quebra o caso sem imagem nem o caso de template
     antigo.
   - Usei `slideSize` (pontos) para a proporção do canvas, não
     `widthPx`/`heightPx` (pixel) — são a mesma razão largura/altura
     (proporção é invariante à unidade), e `slideSize` já é o único dado
     de dimensão que a API expõe pro frontend (o `luna-core` não expõe
     pixel bruto na rota de listagem, só pontos — decisão dele, ver PR
     irmão). Não pedi/inventei um campo novo pra isso.

### Verificado nesta sessão

- `npm run typecheck` — limpo.
- `npm run test:constitution` — `Constitution checks passed (60 files
  scanned)`.
- `npm test` — 30/30 (suíte existente, `lib/forge/__tests__` +
  `lib/ronda/__tests__`; esta mudança é só de componente, sem teste de
  unidade dedicado no repositório para esse tipo de arquivo — mesma
  convenção já em uso aqui, verificação real foi via Playwright, abaixo).
- **Playwright, contra o app real** (`tsx server.ts` local, porta 3100,
  `NEXT_PUBLIC_LUNA_GATEWAY_BASE_URL` no valor padrão de dev que já
  aponta pra `localhost:8080/api` — nenhuma env var nova precisou ser
  configurada): um servidor HTTP mínimo, escrito só para esta sessão de
  verificação (não faz parte do diff), respondeu `GET /convergia/templates`
  /`/templates/:id/image`/`/templates/:id/positions` simulando o
  `luna-core` já com o fix do PR irmão — imagem real de carteirinha
  (640x1010px, gerada com `sharp`, mesmo padrão do PR irmão) e
  `slideSize` calculado com a mesma fórmula que `luna-core` usa
  (`slide-layout.ts`). Naveguei até `/forge` → aba "Convergia" → aba
  "Posicionamento" (template mockado auto-selecionado) e medi
  `getBoundingClientRect()`/`getComputedStyle()` do canvas:
  - **Proporção real**: `aspectRatio` computado = `"456.238 / 720"`
    (o `slideSize` mockado), proporção medida do canvas renderizado =
    `0.6336633663366337`, idêntica à proporção real da imagem
    (`640/1010 = 0.6336633663366337`) — diferença `0`. Não mais forçado
    em 16:9.
  - **Fallback intacto**: repeti com um segundo template mockado sem
    `slideSize` (simulando um template enviado antes do fix) — o canvas
    caiu de volta em `aspect-ratio: 16 / 9` via a classe `aspect-video`,
    proporção medida `1.7777...`, igual a `16/9` — comportamento
    idêntico ao de antes desta correção, não quebrado.
  - Capturas de tela salvas localmente durante a verificação (não fazem
    parte deste PR — só a evidência foi usada aqui).

### O que NÃO foi feito

- Nenhuma mudança na fórmula de `fontSizeToCqw` — só a fonte da largura
  do slide passou a ser dinâmica, a conta em si é a mesma de sempre.
- Nenhum controle de zoom manual.
- Nenhuma mudança em como posição/tamanho em porcentagem são
  persistidos/lidos (`ConvergiaFieldPosition` continua igual).
- Merge, "Ready for review" — branch segue draft, aguardando revisão.
  Depende do PR irmão em `luna-core` para o comportamento ficar correto
  ponta a ponta — sem ele, `GET /convergia/templates` nunca devolve
  `slideSize`, e este editor sempre cai no fallback de 720pt/16:9 (o que
  não é um bug deste PR — é o mesmo comportamento de hoje, preservado de
  propósito).

## 2026-08-09 — Colar imagem (Ctrl+V) no Template Visual do Convergia

**Contexto:** instrução explícita, escopo restrito a
`VisualTemplateUploadStep` (`components/forge/convergia-panel.tsx`) —
não mexer no campo de foto do wizard de ronda (`finding-card.tsx`), que
é fluxo diferente e ficou de fora de propósito.

### O que foi entregue

- `handlePaste` no `onPaste` do container do formulário (não no
  documento inteiro) — só age quando o foco está dentro dessa área.
  Percorre `event.clipboardData.items`, procura o primeiro item com
  `type` começando com `image/`, extrai via `item.getAsFile()`.
- O arquivo colado é **renomeado** (`new File([blob], "Imagem
  colada.png"` ou `.jpg` conforme o `type`) e escrito diretamente no
  `<input type="file">` existente via `DataTransfer` — não um estado
  paralelo, não um segundo caminho de upload. `handleUpload()` (que já
  existia) continua lendo `fileInputRef.current.files[0]` exatamente
  como antes; colar e clicar em "Escolher arquivo" alimentam o mesmo
  arquivo do mesmo input.
- Feedback visual: parágrafo novo (`{pastedFileName} (colada da área de
  transferência)`) no mesmo lugar/estilo onde o feedback de arquivo já
  aparece em `CatalogAndUploadStep` (mesmo padrão do componente
  irmão) — limpo quando um novo arquivo é escolhido por clique
  (`onChange` no input só zera esse estado, não muda o comportamento do
  input em si) ou quando o upload é concluído com sucesso.
- Colar texto comum (sem imagem) dentro da mesma área: nenhum item bate
  `image/`, `event.preventDefault()` nunca é chamado, nada acontece —
  verificado, não é suposição (ver abaixo).
- Nenhuma biblioteca nova — só Clipboard API nativa do navegador
  (`ClipboardEvent`, `DataTransfer`), já disponível no browser.
- Nenhuma mudança no botão/input de arquivo existente além do `onChange`
  que zera o feedback de "colada" — clique continua funcionando
  exatamente como antes.
- `components/ronda/finding-card.tsx` não tocado — fora de escopo,
  como instruído.

### Verificado nesta sessão

- `pnpm run typecheck` — limpo.
- `pnpm run test:constitution` — `Constitution checks passed (60 files
  scanned)`.
- `pnpm test` — **30/30** (suíte existente; esta mudança é só de
  componente/interação de UI, sem teste de unidade dedicado no
  repositório para esse tipo de arquivo — mesma convenção já usada nos
  fixes anteriores de `convergia-position-editor.tsx`, verificação real
  foi via Playwright, abaixo).
- **Playwright, contra o app real** (`tsx server.ts` local, porta 3000
  neste ambiente — a porta 3100 citada em entradas anteriores não se
  confirmou aqui, o server sobe na 3000 por padrão; `POST
  /convergia/templates/visual` interceptado via `page.route()`, já que
  não há `luna-core` real alcançável neste sandbox — mesmo padrão já
  usado na entrada de 2026-08-07 do wizard de ronda):
  - Naveguei até `/forge` → aba "Convergia" → aba "Template Visual",
    preenchi o nome do template, e disparei um `ClipboardEvent("paste")`
    sintético no container do formulário com uma imagem PNG real
    (bytes decodificados de base64, não um mock vazio) via
    `DataTransfer`.
  - Confirmado via `page.evaluate` que o `<input type="file">` real
    passou a ter `files[0]` com `name: "Imagem colada.png"`,
    `type: "image/png"` — o mesmo elemento que o clique usaria, não um
    estado paralelo.
  - Confirmado o texto "Imagem colada.png (colada da área de
    transferência)" visível na tela.
  - Cliquei em "Enviar imagem" (o mesmo botão de sempre, sem lógica
    nova) e confirmei que exatamente 1 requisição `POST
    /convergia/templates/visual` foi capturada, com corpo `multipart`
    não vazio (376 bytes), e que a tela mostrou "Template criado
    (tmpl-test-123)…" — o mesmo fluxo de sucesso que o upload por
    clique já produz.
  - Segunda verificação: colei **texto comum** (`"algum texto qualquer
    colado sem querer"`, sem imagem) na mesma área — confirmado que
    `input.files.length` permaneceu `0`, nenhuma requisição de upload
    foi disparada, e o texto de feedback "colada da área de
    transferência" não apareceu. Não é suposição de "deve ser inofensivo
    por não ter código pra isso" — foi de fato exercitado.
  - Os dois scripts de verificação (`page.route` + `ClipboardEvent`
    sintético) foram escritos só para esta sessão e removidos antes do
    commit — não fazem parte do diff.

### O que NÃO foi feito

- Nenhuma mudança em `components/ronda/finding-card.tsx` ou em qualquer
  outro campo de foto fora do Template Visual do Convergia — fora de
  escopo, por instrução explícita.
- Nenhuma troca do `<input type="file">` existente por componente
  customizado — colar é aditivo, o clique continua idêntico.
- Nenhuma biblioteca nova adicionada a `package.json`/`pnpm-lock.yaml`.
- Teste automatizado de Playwright **não foi adicionado ao repositório**
  — não existe suíte de Playwright configurada aqui (`pnpm test` roda só
  `tsx --test` sobre `lib/forge/__tests__`/`lib/ronda/__tests__`, testes
  de lógica pura, não há harness de Playwright versionado no projeto
  para componente de UI). A verificação via Playwright desta sessão foi
  manual/ad-hoc contra o app real, documentada acima em detalhe, mesma
  convenção já usada nas duas entradas anteriores deste arquivo — não
  criei infraestrutura de teste E2E nova sem instrução explícita para
  isso.

## 2026-08-09 — Tema claro/escuro alternável no wizard de ronda (`/ronda`)

**Contexto:** instrução explícita, escopo restrito à rota `/ronda`
(`app/ronda/`, `components/ronda/`) — Forge não tocado. Escuro é o
padrão do produto; alternância manual via botão, preferência persistida.

### O que foi entregue

- **`tailwind.config.ts`**: `darkMode: "class"` — não existia antes
  (nenhum lugar do repositório usava `dark:`), estratégia certa porque a
  troca é manual, não por `prefers-color-scheme`.
- **`lib/ronda/theme.ts`**: `RondaTheme`/`RONDA_THEME_STORAGE_KEY`
  (`"luna-ronda-theme"`), módulo mínimo, sem lógica.
- **`components/ronda/theme-provider.tsx`** (novo): `RondaThemeProvider`
  + hook `useRondaTheme()`. **Achado de arquitetura relevante,
  documentado pra quem for mexer nisso depois:** o Tailwind gera o
  seletor de `dark:` como `.dark :is(...)` — um combinador de
  descendente, que **não bate quando a classe `dark` e a classe
  `dark:algo` estão no mesmo elemento**. Por isso o toggle vive num
  elemento pai (`id="ronda-theme-root"`, só a classe `dark`, sem estilo
  visual) e as classes visuais (`bg-[#F4F6FB] dark:bg-[#1E2761]` etc.)
  vivem num filho (`id="ronda-root"`). Descobri isso porque a primeira
  versão (tudo numa `<div>` só) passou no `typecheck` e nos testes, mas
  o navegador real mostrava sempre o tema claro mesmo com a classe
  `dark` presente — só apareceu ao inspecionar `getComputedStyle` de
  verdade no Chromium, não é algo que teste de tipo/lint pega.
  - Script inline (`dangerouslySetInnerHTML`) aplica a preferência
    salva **antes da primeira pintura** (mesma técnica de bibliotecas
    como `next-themes`) — servidor sempre renderiza com `dark` presente
    (padrão do produto), o script só remove a classe se
    `localStorage` disser `"light"`.
  - `toggleTheme()` também grava no `localStorage` (com fallback
    silencioso se indisponível — modo privado, cota etc. — a troca em
    si não quebra, só não persiste).
- **`components/ronda/theme-toggle.tsx`** (novo): botão de alternância,
  texto "☾ Escuro"/"☀ Claro" conforme o tema atual, no cabeçalho do
  wizard (`ronda-wizard.tsx`, canto superior direito, ao lado do
  título) — visível em toda etapa do wizard, não só na inicial.
- **`app/ronda/layout.tsx`**: `<div>` estático trocado por
  `<RondaThemeProvider>`; `viewport.themeColor` atualizado de
  `"#0a0c10"` (cor antiga, não usada em nenhum outro lugar) para
  `"#1E2761"` (Midnight, a cor de fundo escuro real agora).
- **Inventário completo de cor hardcoded assumindo fundo escuro**,
  convertido com par claro/escuro em `app/ronda/`, `finding-card.tsx`,
  `queue-status-bar.tsx`, `ronda-wizard.tsx`: `border-white/NN` →
  `border-black/NN dark:border-white/NN`, `bg-white/[0.03]` →
  `bg-black/[0.03] dark:bg-white/[0.03]`, `bg-black/30` (barra de fila)
  → `bg-black/5 dark:bg-black/30`, `text-slate-100/200/300/400` →
  contraparte mais escura (`slate-900/800/700/600`) `dark:` a versão
  original. `[color-scheme:dark]` nos inputs virou
  `[color-scheme:light] dark:[color-scheme:dark]` (afeta o popup nativo
  de `<select>`/`<input type=date>`/checkbox — sem isso, o popup nativo
  ficaria sempre escuro mesmo em tema claro, herdando o
  `:root { color-scheme: dark }` global do `app/globals.css`, que não
  foi tocado, é intencionalmente global pro resto do app).
- **Não alterado, por decisão explícita da instrução**: as cores de
  estado/classificação em si (seletor de estado
  vermelho/âmbar/esmeralda em `finding-card.tsx`, badge "pendente",
  caixa de alerta "Ainda falta avaliar" na Etapa 3, indicadores de fila
  em `queue-status-bar.tsx`, os botões `bg-cyan-500`/`bg-emerald-500
  text-black` de avançar/concluir) — hex idêntico nos dois modos, só
  verifiquei contraste (achado abaixo, relevante).

### Achado de contraste — grave, precisa de decisão do Architect (leia antes de aprovar)

Medi contraste real (WCAG, `getComputedStyle` no Chromium real, cor de
fundo composta com blend do alfa sobre a cor de página — não só a cor
nominal do token):

| Elemento (modo claro) | Contraste medido |
|---|---|
| Chip "Risco identificado" selecionado (`bg-red-400/15 text-red-300`) | **1.53:1** |
| Badge "pendente" (`bg-amber-400/15 text-amber-300`) | **1.24:1** |
| Chip "Considerado inexistente" selecionado (`bg-emerald-400/15 text-emerald-300`) | **1.28:1** |
| Chip "Não avaliado" selecionado — padrão de todo card (`bg-amber-400/15 text-amber-300`) | **1.24:1** |
| Caixa de alerta "Ainda falta avaliar" na Etapa 3 (`text-amber-300` sobre `bg-amber-400/10`) | **1.33:1** |

Todos muito abaixo até do mínimo de UI/texto grande (3:1), quanto mais
do texto normal (4.5:1) — na prática, quase ilegível a olho nu em tema
claro (confirmei visualmente nas capturas de tela, não só no número —
ver `/tmp/ronda-claro-etapa-B.png` e `/tmp/ronda-claro-etapa-C.png`
desta sessão, não fazem parte do PR). Causa raiz: esse padrão de cor
(`text-COR-300` sobre `bg-COR-400/15`) foi desenhado assumindo página
de fundo escuro — funciona bem no modo escuro (não mudou, não medi
regressão ali), mas quebra especificamente no modo claro, porque o
texto "claro sobre translúcido" perde quase todo contraste quando a
translucidez passa a compor com uma página quase branca em vez de quase
preta.

**Corrigido (mesma sessão, instrução do Engineer):** mesmo princípio já
usado nas cores de classificação (Tarefa 2) — manter o matiz
(vermelho/âmbar/esmeralda), não inverter o significado da cor, mas
resolver a legibilidade. Aplicado nos 5 pontos da tabela acima:
opacidade do fundo subiu de `/15` (ou `/10`, na caixa de alerta) para
`/40` **só no modo claro** (`bg-COR-400/40`, sem prefixo `dark:`), com
o `dark:` preservando o valor original (`/15`/`/10`) exatamente como
estava — modo escuro não mudou. Texto trocado de `text-COR-300` (claro,
desenhado pra fundo escuro) para `text-COR-900` (`-900` da mesma
família de cor, não uma cor fora da paleta) só no modo claro, mesma
lógica de `dark:` preservando `-300` no modo escuro.

Recalculado (mesma metodologia — `getComputedStyle` no Chromium real,
blend de alfa real sobre a cor de fundo efetiva, não a cor nominal):

| Elemento (modo claro, depois da correção) | Contraste | Critério aplicado |
|---|---|---|
| Chip "Risco identificado" selecionado | **6.35:1** | texto normal (≥4.5:1) — rótulo curto mas não é texto "grande" no sentido do WCAG (não é ≥18.66px/bold ou ≥24px), medi pelo critério mais rígido |
| Badge "pendente" | **6.98:1** | texto normal (≥4.5:1), mesmo critério — `text-[10px]`, ainda mais motivo pra não relaxar pra 3:1 |
| Chip "Considerado inexistente" selecionado | **7.01:1** | texto normal (≥4.5:1) |
| Chip "Não avaliado" — padrão de todo card | **6.98:1** | texto normal (≥4.5:1) |
| Caixa de alerta "Ainda falta avaliar" (Etapa 3) | **6.98:1** | texto normal (≥4.5:1) — texto do parágrafo, corpo de frase, não título |

Todos os 5 passam confortavelmente o critério mais rígido (texto
normal, 4.5:1) — não precisei recorrer ao critério mais frouxo de texto
grande (3:1) em nenhum caso, então não há ambiguidade de qual critério
se aplica. Modo escuro **não mudou**: reconferido com o mesmo script,
valores idênticos aos já registrados antes da correção (`7.15:1`,
`5.98:1`, `6.81:1`, `7.96:1`) — confirmação de que o `dark:` preservou
o comportamento original, não é suposição.

### Verificado nesta sessão

- `pnpm run typecheck` — limpo.
- `pnpm run test:constitution` — `Constitution checks passed (63 files
  scanned)`.
- `pnpm test` — **30/30** (suíte existente; tema é CSS/DOM, sem lógica
  nova testável em `lib/` além do módulo `theme.ts`, que é só
  tipo+constante, sem função pra testar).
- **Playwright, contra o app real** (`tsx server.ts` local, porta 3000
  neste ambiente):
  - Confirmado `getComputedStyle` do elemento raiz: fundo padrão
    `rgb(30, 39, 97)` (= `#1E2761`) com a classe `dark` presente, sem
    clicar em nada — escuro é o padrão de fato, não só de intenção.
  - Cliquei no botão de alternância: fundo mudou pra
    `rgb(244, 246, 251)` (= `#F4F6FB`), classe `dark` removida.
  - **Persistência confirmada de verdade**: depois de `page.reload()`
    (recarregamento completo, não navegação client-side), a classe
    `dark` continuou ausente — a preferência "claro" sobreviveu ao
    reload via `localStorage` + o script de aplicação antes da pintura.
  - **Screenshots de tela inteira das 3 etapas do wizard (A, B com um
    achado expandido mostrando todos os campos, C com a caixa de
    alerta), nos dois modos** — 6 capturas no total, mais 1 pós-reload.
    Confirmei visualmente que nada estrutural (bordas, fundos de card,
    texto de rótulo, inputs, botões) fica ilegível ou invisível em
    nenhum dos dois modos — a única coisa realmente ilegível é o achado
    de contraste documentado acima, que é sobre cor de estado
    preservada de propósito, não sobre a estrutura geral do tema.
  - Popup nativo de `<select>`/`<input type=date>` em modo claro **não
    foi re-verificado visualmente** — mesma limitação já documentada na
    entrada de 2026-08-06 deste arquivo (Chromium headless não renderiza
    o popup nativo desses widgets com o tema real do SO/tela). Apliquei
    `[color-scheme:light] dark:[color-scheme:dark]` pela mesma lógica
    documentada ali (é a recomendação padrão, `color-scheme` no próprio
    elemento, não só herdado), mas não tenho como provar visualmente
    neste ambiente — mesma ressalva de antes.
  - Scripts de verificação (2, incluindo um que recalcula contraste com
    blend de alfa real) escritos só para esta sessão, removidos antes
    do commit — não fazem parte do diff.
  - **Correção do achado de contraste (mesma sessão, ver acima)**:
    `pnpm run typecheck` limpo, `pnpm run test:constitution` (63
    arquivos) e `pnpm test` (30/30) repetidos depois da mudança — sem
    regressão. Screenshots antes/depois de cada elemento corrigido, nos
    dois modos: `/tmp/fix2-escuro-*.png` (confirmam que nada mudou
    visualmente no modo escuro) e `/tmp/fix2-claro-*.png` (confirmam a
    correção — badges/chips/caixa de alerta legíveis de verdade agora,
    não só "passa no número"). Não fazem parte do PR.

### O que NÃO foi feito

- ~~Nenhuma correção do achado de contraste acima~~ — **corrigido nesta
  sessão**, por instrução explícita do Engineer (ver "Achado de
  contraste" acima) — não é mais uma pendência.
- Forge não tocado — `darkMode: "class"` é global no `tailwind.config.ts`
  (não tem como escopar por rota), mas nenhum arquivo fora de `/ronda`
  usa `dark:`, então isso não muda nada visualmente fora da rota.
  Confirmado via busca — não há outro uso de `dark:` no repositório
  além do que esta entrega adicionou.
- Nenhuma automação de tema por `prefers-color-scheme` — só o botão
  manual, como pedido.

## 2026-08-09 — Cores de classificação sólidas no wizard de ronda (`finding-card.tsx`)

**Contexto:** instrução explícita, escopo restrito ao campo
"Classificação" de `components/ronda/finding-card.tsx` — o seletor de
estado (não avaliado/identificado/inexistente) do mesmo componente não
foi tocado, decisão do Architect (conceito diferente, sem
correspondência no relatório final).

### O que foi entregue

- `<select>` nativo de Classificação trocado por um seletor de botões
  (`role="radiogroup"`, cada opção `button role="radio"`), mesmo
  mecanismo de interação do seletor de estado logo acima no componente.
- Selecionado: preenchimento sólido na cor exata do protótipo
  (`#2E7D32` positivo, `#E8A33D` atenção, `#C62828` não conformidade),
  texto branco por cima. Cores como classe Tailwind arbitrária estática
  (`bg-[#2E7D32]` etc., não um template dinâmico) para o JIT do
  Tailwind conseguir escanear a classe no build.
- Não selecionado: mesmo tratamento neutro já usado nas opções
  não-selecionadas do seletor de estado (`border-white/15 text-slate-400
  hover:border-white/30`) — consistência interna do componente.
- `FINDING_CLASSIFICATIONS`/`FINDING_CLASSIFICATION_LABELS` não
  mudaram — só a aparência do seletor.

### Achado durante a verificação (relevante, leia antes de aprovar)

Contraste real medido via `getComputedStyle` no Chromium real (não só
"parece branco"), fórmula WCAG padrão (luminância relativa sRGB):

| Classificação | Fundo | Texto | Contraste medido |
|---|---|---|---|
| Positivo | `#2E7D32` | `#FFFFFF` | **5.13:1** — passa AA texto normal (≥4.5:1) |
| Atenção | `#E8A33D` | `#FFFFFF` | **2.16:1** — não passa nem AA texto normal (4.5:1) nem AA texto grande (3:1) |
| Não Conformidade | `#C62828` | `#FFFFFF` | **5.62:1** — passa AA texto normal |

Tentei ajustar o branco pra um tom levemente diferente antes de aceitar
isso (a instrução previa essa saída), mas matematicamente não há
solução dentro de "bem próximo do branco": a luminância relativa do
fundo `#E8A33D` já é ~0.437 sozinha — mesmo com texto branco puro
(luminância 1, o máximo possível), o teto de contraste alcançável
contra esse fundo é ~2.16:1, e qualquer tom "quase branco" fica ainda
mais perto dessa luminância, não mais longe. Melhorar de verdade exigiria
texto escuro (ex. preto), o que contradiz a instrução explícita de
"texto claro/branco por cima" pros três — não fiz essa troca por conta
própria porque a instrução foi explícita sobre a cor de texto, mas
registro aqui: **"Atenção" fica abaixo do padrão WCAG AA de contraste
de texto**, mesmo com a melhor implementação possível dentro do
requisito dado. Capturas de tela (`/tmp/classificacao-*.png`, não
fazem parte deste PR) mostram que o texto continua legível a olho nu
sobre o laranja — não é ilegível na prática, só não passa no critério
formal de acessibilidade. Recomendo ao Architect decidir entre manter
como está (cor exata do protótipo, prioridade sobre WCAG) ou usar texto
escuro só para "Atenção" — não tomei essa decisão sozinho.

**Corrigido (mesma sessão, instrução do Engineer):** fundo `#E8A33D`
mantido exato (cor de marca), texto trocado de `#FFFFFF` para `#1E2761`
(Midnight, já usado em outro lugar do projeto) só em "Atenção".
Recalculado (mesma metodologia, `getComputedStyle` no Chromium real):
luminância de `#1E2761` ≈ 0.0259, contraste contra `#E8A33D`
(luminância ≈ 0.437) = **6.41:1 — passa AA texto normal (≥4.5:1)**, não
foi preciso cair pra preto puro. Positivo e Não Conformidade não
mudaram (`#FFFFFF`, já passavam AA). Screenshot de confirmação em
`/tmp/fix1-depois-aten--o.png` (não faz parte do PR) — texto legível
sem ambiguidade, não só "passa no número".

### Verificado nesta sessão

- `pnpm run typecheck` — limpo.
- `pnpm run test:constitution` — `Constitution checks passed (60 files
  scanned)`.
- `pnpm test` — **30/30** (suíte existente; classificação é só
  componente de UI, sem teste de unidade dedicado pra esse tipo de
  arquivo no repositório).
- **Playwright, contra o app real** (`tsx server.ts` local, porta 3000
  neste ambiente): preenchi a Etapa 1 com dado sintético, avancei pra
  Etapa 2, marquei "Trabalho em Altura" como "Risco identificado" e
  cliquei nas 3 opções de Classificação em sequência. Para cada uma,
  medi `getComputedStyle` do botão selecionado (cor de fundo real
  batendo com o hex esperado, `aria-checked="true"` confirmado) e tirei
  screenshot da tela inteira — ver achado de contraste acima. Script de
  verificação escrito só para esta sessão, removido antes do commit —
  não faz parte do diff.
- **Correção do achado de contraste (mesma sessão, ver acima)**:
  `pnpm run typecheck` limpo, `pnpm run test:constitution` (60 arquivos)
  e `pnpm test` (30/30) repetidos depois da mudança de cor de texto —
  sem regressão. Repeti a verificação via Playwright das 3 classificações
  (mesmo script/metodologia), confirmando `text=rgb(30, 39, 97)` no botão
  "Atenção" selecionado e contraste `6.41:1`.

### O que NÃO foi feito

- Seletor de estado (não avaliado/identificado/inexistente) — cores e
  estilo continuam exatamente como estavam.
- `FINDING_CLASSIFICATIONS` — lista de opções não mudou.
- ~~Nenhuma correção de contraste aplicada por conta própria em
  "Atenção"~~ — **corrigido nesta sessão**, por instrução explícita do
  Engineer (ver "Achado durante a verificação" acima) — não é mais uma
  pendência.
- Merge, "Ready for review" — branch segue draft, aguardando revisão.

## 2026-08-09 — Rebase pós-merge do PR #18 (tema claro/escuro) + acessibilidade de teclado no seletor de Classificação

**Contexto:** o PR #18 (tema claro/escuro) foi mergeado em `main`
depois do rebase anterior desta branch. Os dois PRs mexem no mesmo
arquivo (`finding-card.tsx`) — #18 converteu o componente inteiro para
pares de classe `dark:`, #17 (esta branch) trocou o `<select>` de
Classificação por um seletor de botões. Desta vez o conflito não foi só
o acréscimo de sempre no fim do `BUILDER.md` — houve conflito de
conteúdo real em `finding-card.tsx`, porque as duas mudanças nunca
tinham sido vistas juntas.

### O que foi entregue

- **Rebase** (`git rebase origin/main`, não merge) das duas commits
  desta branch em cima do `main` já com o PR #18 mergeado.
- **Resolução do conflito em `finding-card.tsx`**: mantida a estrutura
  de botões do seletor de Classificação (introduzida por esta branch),
  mas com as classes de tema claro/escuro do PR #18 aplicadas em cima —
  `text-slate-400` (só escuro) virou `text-slate-600 dark:text-slate-400`
  no wrapper, e o estado "não selecionado" dos botões de classificação
  ganhou o mesmo par `border-black/15 ... dark:border-white/15 ...` que
  o seletor de estado logo acima já usa — consistência interna do
  componente, mesmo padrão que o PR #18 já tinha estabelecido em todo o
  resto do arquivo. `CLASSIFICATION_FILL_CLASS` (preenchimento sólido
  quando selecionado) não precisou de `dark:` — são cores de marca fixas
  (`#2E7D32`/`#E8A33D`/`#C62828`), o mesmo motivo pelo qual os botões
  `bg-cyan-500`/`bg-emerald-500` de avançar/concluir também não têm
  variante de tema.
- **Resolução do conflito no `BUILDER.md`**: mesmo padrão de sempre
  (acréscimo no mesmo ponto do arquivo) — mantidas as entradas do PR #18
  e desta branch, ordem cronológica preservada, cada uma com suas
  próprias seções `### Verificado nesta sessão`/`### O que NÃO foi
  feito` completas (não fundidas).
- **Acessibilidade de teclado no seletor de Classificação** (achado de
  revisão automatizada do Codex neste PR, linha 176 de
  `finding-card.tsx`): a troca do `<select>` nativo por botões deu
  clique, mas não deu o comportamento padrão de radiogroup por teclado
  que o `<select>` nativo tinha de graça — um único tab stop pro grupo
  inteiro, setas movendo E selecionando entre as opções (padrão
  WAI-ARIA APG para radiogroup, "seleção segue o foco"). Corrigido com
  `tabIndex` roving (só a opção selecionada — ou a primeira, se nada
  selecionado ainda — tem `tabIndex=0`, as outras `-1`) + `onKeyDown`
  tratando `ArrowRight`/`ArrowDown` (próxima opção) e
  `ArrowLeft`/`ArrowUp` (anterior), com wrap-around nas pontas e foco
  movido pra o botão recém-selecionado via `querySelector` dentro do
  `radiogroup` mais próximo. O seletor de Estado (acima no mesmo
  componente) tem a mesma lacuna, mas é pré-existente — não introduzida
  por este PR — e ficou fora de escopo desta correção pontual.

### Verificado nesta sessão

- `pnpm run typecheck` — limpo.
- `pnpm run test:constitution` — `Constitution checks passed (63 files
  scanned)`.
- `pnpm test` — **30/30** (suíte existente).
- **Playwright, contra o app real** (`tsx server.ts` local, porta 3000
  neste ambiente) — dois scripts, o ponto de risco real desta sessão
  (as duas mudanças nunca tinham sido testadas juntas):
  - **Coexistência classificação + tema**: preenchi a Etapa 1, avancei,
    marquei "Risco identificado", e cliquei nas 3 classificações **nos
    dois modos** (escuro primeiro, depois alternando pra claro sem
    recarregar a página). Confirmado via `getComputedStyle` que as 3
    cores de fundo/texto são **idênticas nos dois modos**
    (`rgb(46,125,50)`/branco Positivo, `rgb(232,163,61)`/`rgb(30,39,97)`
    Atenção, `rgb(198,40,40)`/branco Não Conformidade) — exatamente o
    esperado, já que são cores de marca fixas, não deveriam variar com
    o tema. Screenshots de tela inteira da Etapa B nos dois modos
    (`/tmp/final-{escuro,claro}-etapaB-full.png`, não fazem parte do
    PR) confirmam visualmente que os botões não-selecionados de
    Classificação (`Positivo`/`Atenção` quando `Não Conformidade` está
    selecionada) também seguem o tema corretamente, e que nada mais no
    card ficou afetado pela coexistência das duas mudanças.
  - **Navegação por teclado**: focei "Positivo" via `.focus()` e
    disparei `ArrowRight`/`ArrowLeft` reais via `page.keyboard.press`
    (não simulação de evento sintético) — confirmado `aria-checked` e
    `document.activeElement` corretos a cada passo, incluindo
    wrap-around nas duas pontas (Não Conformidade → Positivo indo pra
    frente, Positivo → Não Conformidade indo pra trás), e `tabIndex`
    roving correto antes de qualquer seleção (`[0,-1,-1]`, foco só em
    "Positivo") e depois de selecionar "Não Conformidade"
    (`[-1,-1,0]`).
  - Scripts de verificação (2) escritos só para esta sessão, removidos
    antes do commit — não fazem parte do diff.

### O que NÃO foi feito

- Nenhuma mudança na lacuna de teclado do seletor de Estado
  (não avaliado/identificado/inexistente) — pré-existente, fora do
  escopo do achado do Codex (que apontou especificamente o seletor de
  Classificação, introduzido por este PR).
- Merge, "Ready for review" — branch segue draft, aguardando revisão.

## 2026-08-09 — Modal "Iniciar Sessão Cognitiva" na Home, com atalho pro Forge/Convergia

### Causa

O botão "Iniciar Sessão Cognitiva" no Hero (`components/hero.tsx`) era
um `<button>` sem `onClick` — puramente decorativo, nunca foi ligado a
nada. `/forge` e `/ronda` já existem e funcionam, mas nenhum link
visível na home (`app/page.tsx`) apontava pra eles.

### O que foi entregue

- **`components/cognitive-session-modal.tsx`** (novo): modal sobreposto
  à página atual (não navega pra rota nova ao abrir) com um botão "Luna
  Convergia" que leva pro Forge. Fechável por X, clique fora do painel
  (`onMouseDown` comparando `event.target === event.currentTarget`,
  então cliques dentro do painel não fecham por bubbling) e tecla Esc
  (`keydown` no `document`, só enquanto `open`). `role="dialog"` +
  `aria-modal` + `aria-labelledby` pro título. Só `/forge` — `/ronda`
  fica fora deste modal, não foi pedido desta vez.
- **`components/hero.tsx`**: botão "Iniciar Sessão Cognitiva" ganhou
  `onClick` que abre o modal via `useState`. "Explorar Pipeline" não
  foi tocado — segue decorativo, fora de escopo.
- **Aba Convergia via URL** (`?tab=convergia`), não só o Workspace
  padrão: investiguei `components/forge/forge-layout.tsx` antes de
  assumir que dava — o `Tabs` do Radix usava `defaultValue="workspace"`
  fixo. Troquei por uma prop `initialTab` (`"workspace" | "convergia"`,
  default `"workspace"` — não muda o comportamento de quem já usa
  `<ForgeLayout />` sem prop). `app/forge/page.tsx` virou `async` e lê
  `searchParams` (Next 15 — é uma `Promise`) pra decidir a prop. O
  botão "Luna Convergia" navega com `router.push("/forge?tab=convergia")`.

### Verificado nesta sessão

- `npm run typecheck` — limpo.
- `npm run test:constitution` — `Constitution checks passed (64 files
  scanned)`.
- `npm test` — **30/30** (suíte existente, nenhum teste novo — não há
  suíte de componentes React neste repo).
- **Playwright, contra o app real** (`tsx server.ts` local, porta 3000):
  clicou em "Iniciar Sessão Cognitiva", confirmou o modal aberto com
  "Luna Convergia" visível; testou as 3 formas de fechar (Esc, clique
  fora, X) reabrindo o modal entre cada uma; clicou em "Luna Convergia"
  e confirmou `page.url()` real em `/forge?tab=convergia` (não só
  mudança de aparência) e a aba Convergia com `data-state="active"` no
  Radix Tabs. Script de verificação escrito só para esta sessão,
  removido antes do commit — não faz parte do diff.

### O que NÃO foi feito

- Botão "Explorar Pipeline" — segue sem função, fora de escopo desta
  instrução (pendente separado).
- Acesso a `/ronda` no modal — só Convergia foi pedido desta vez.
- Nenhum redesign do resto da home.
- Merge, "Ready for review" — branch segue draft, aguardando revisão.

## 2026-08-09 — Renomeação "Ronda" → "LUNA Safety Walk" + botão no modal da home

Duas entregas relacionadas na mesma sessão: a renomeação (item 1) é
pré-requisito de nome pro botão do modal (item 2). A terceira entrega da
mesma sessão (edição de ronda já enviada) tem entrada própria, logo
abaixo, e PR separado (depende deste, para reaproveitar o nome novo e o
link de entrada).

### 1. Renomeação "Ronda"/"Ronda Fotográfica" → "LUNA Safety Walk"

Varredura completa de `/ronda` (não só o óbvio) via `grep -rn "Ronda" .`
no repositório inteiro, revisando cada ocorrência antes de decidir tocar
ou não:

- **Trocado** (nome visível na interface): `h1` do wizard, os 4 estados
  do subtítulo por etapa, placeholder do campo Título, as duas mensagens
  da tela final ("salvo"/"registrado"), os dois botões
  ("Concluir .../Nova ..."), `<title>` da aba do navegador e
  `appleWebApp.title` (`app/ronda/layout.tsx`), `name`/`short_name`/
  `description` do manifest PWA (`public/ronda-manifest.json`).
- **Não tocado**, deliberadamente: identificadores de código
  (`RondaWizard`, `RondaFinding`, `enqueueRonda`, etc. — refatoração de
  nome de símbolo não foi pedida e não muda nada visível), a rota `/ronda`
  em si (pedido explícito: só o nome exibido muda), a chave de storage
  local `luna-ronda-theme`/nome do IndexedDB `luna-ronda` (mudar
  quebraria preferência de tema e fila offline já salva de quem já
  instalou o PWA), e mensagens de `console.error` (não são UI, só log de
  depuração).
- Gênero gramatical: tratado "LUNA Safety Walk" como substantivo
  masculino em português ("o LUNA Safety Walk", "registrado", "salvo") —
  convenção comum para estrangeirismo técnico sem gênero óbvio, decisão
  de estilo desta sessão, não pedido explícito do Architect.

### 2. Botão "LUNA Safety Walk" no modal da home

`components/cognitive-session-modal.tsx`: segundo botão, mesmo padrão
visual do botão "Luna Convergia" existente (mesmo `className`, ícone à
esquerda + texto principal + descrição curta) — `Footprints` (lucide-react,
já no `package.json`, `^0.469.0`) em vez de `GitBranch`, navega para
`/ronda` via `router.push`.

### Verificado nesta sessão

- `npm run typecheck` — limpo.
- `npm run test:constitution` — `Constitution checks passed (68 files
  scanned)`.
- `npm test` — **30/30** (suíte existente, nenhum teste novo — não há
  suíte de componentes React neste repo).

### Verificado ponta a ponta, contra produção real (Guardian) e via UI real (Playwright)

`luna-frontend` local (`tsx server.ts`, porta 3000) contra um `luna-core`
local (porta 8080) rodando a branch companheira desta sessão (`PATCH
/convergia/ronda/:id`, ver entrada seguinte), que por sua vez fala com o
Guardian real de produção (`strong-celebration`).

- **Item 1** (Playwright): completou o wizard inteiro (Etapa A → B → C →
  concluir) contra o backend real; confirmou `<title>` da aba, `h1` em
  cada etapa, texto dos botões e da tela final — todos "LUNA Safety
  Walk", nenhum "Ronda Fotográfica" residual (`assert` negativo no HTML
  da página). Screenshot de cada etapa. A ronda sintética criada por este
  teste foi removida do Guardian real depois (ver entrada seguinte,
  "Limpeza" — a remoção cobriu os registros dos dois PRs desta sessão de
  uma vez).
- **Item 2** (Playwright): abriu o modal a partir da home real, confirmou
  os dois botões ("Luna Convergia" preservado + "LUNA Safety Walk" novo,
  mesmo padrão visual), clicou no novo e confirmou navegação real para
  `/ronda` (`page.url()`, não só mudança visual).

### O que NÃO foi feito

- Botão "Explorar Pipeline" — inalterado, fora de escopo.
- Nenhum teste automatizado novo commitado (nem componente React — não
  existe suíte desse tipo aqui — nem Playwright): o script usado nesta
  sessão viveu fora do repositório (diretório de scratch), removido ao
  final — não faz parte do diff.
- Merge, "Ready for review" — branch segue draft, aguardando revisão.

## 2026-08-09 — Edição de ronda já enviada (extensão da Fase 1/CONV-013): histórico + patch

Backend companheiro: `luna-core` PR desta mesma sessão,
`PATCH /convergia/ronda/:id` (ver `luna-core` `BUILDER.md`, mesma data).

- **`lib/ronda/types.ts`** — `RondaPatch` (espelha
  `luna-core/src/convergia/ronda/contracts.ts`, mesmo padrão de cópia
  deliberada já usado pelo resto deste arquivo).
- **`lib/ronda/api-client.ts`** — `listRondas`, `getRonda` (novo tipo
  `RondaDetail = RondaSubmission & {createdAt}`) e `patchRonda`, mesmo
  padrão de erro (`RondaSubmitError`) que `submitRonda` já usa. Reaproveita
  `RondaSubmitResult` já existente em vez de criar um segundo tipo de
  resumo.
- **`app/ronda/historico/page.tsx`** + **`components/ronda/ronda-list.tsx`**
  — lista mínima (`GET /convergia/ronda`): data, local, quantidade de
  achados, nada além disso. Sem dashboard/filtro/gráfico — isso é o
  painel de gestão completo, decisão maior ainda pendente (P3 do
  documento de extensão do ADR-021), fora de escopo aqui por pedido
  explícito.
- **`app/ronda/historico/[id]/page.tsx`** + **`components/ronda/ronda-editor.tsx`**
  — edição: reaproveita `FindingCard` (mesmo componente de achado do
  wizard original, nenhuma UI nova de achado) para as 7 categorias, mais
  um campo de observação geral. "Adicionar achado" = marcar uma categoria
  ainda não identificada; "remover achado" = reverter uma categoria
  identificada de volta a não-identificada — o modelo de dado sempre tem
  as 7 categorias presentes (nunca um array de tamanho variável), então
  não existe "índice" de achado a apagar, só o `estado` de cada categoria
  a mudar (mesmo mecanismo que `FindingCard.setEstado` já usa no wizard
  original). Salvar chama `patchRonda` com a lista completa de achados +
  a observação geral — o backend já mescla por `categoria`, então reenviar
  tudo é seguro e mais simples que calcular um diff no cliente. Next.js 15
  — `params` é `Promise<{id: string}>`, `page.tsx` é `async`.
- Link de entrada: "Ver rondas anteriores" na Etapa A do wizard
  (`ronda-wizard.tsx`), abaixo do campo Turno — lugar mais natural
  encontrado (fim do formulário inicial, antes de avançar), não elaborado
  além disso, conforme pedido.
- **Fora de escopo, deliberadamente**: exclusão de ronda inteira (decisão
  destrutiva separada, não pedida aqui) e edição de `metadata`
  (título/data/local/responsável/turno — só achados e observação geral).

### Verificado nesta sessão

- `npm run typecheck` — limpo.
- `npm run test` — **30/30** (suíte existente, nenhum teste novo —
  `lib/ronda/api-client.ts` já não tinha teste próprio antes desta
  sessão; `submitRonda` também não tem, mesmo padrão mantido).
- `npm run test:constitution` — `Constitution checks passed (68 files
  scanned)`.
- `npm run build` (`next build`) — build de produção completo sem erro;
  as duas rotas novas aparecem no relatório (`/ronda/historico` estática,
  `/ronda/historico/[id]` dinâmica).

### Verificado ponta a ponta, contra produção real (Guardian) e via UI real (Playwright)

`luna-frontend` local (`tsx server.ts`, porta 3000) contra um `luna-core`
local (porta 8080) rodando a branch companheira desta entrega (`PATCH
/convergia/ronda/:id`), que por sua vez fala com o Guardian real de
produção (`strong-celebration`) — mesma cadeia que as entregas anteriores
de Convergia usaram.

Criada uma ronda sintética real via `curl` direto no backend local (7
categorias, 1 achado identificado, título/local claramente marcados
"TESTE E2E ... apagar"), editada uma vez via `curl` (`PATCH` — achado
adicionado, achado removido, observação editada) para confirmar o backend
isoladamente (ver `luna-core` `BUILDER.md` para esse lado), depois
**editada de novo pela UI real**: `/ronda` → "Ver rondas anteriores" →
lista mostra a ronda de teste com contagem/data/local corretos → abre o
editor → estado carregado bate com o que o `curl` tinha salvo (observação
geral e achados corretos, inclusive o achado identificado por engano
anterior mostrando "Risco identificado" selecionado) → editou a
observação geral de novo e adicionou um segundo achado (Espaço Confinado,
preenchendo departamento/classificação/gravidade/descrição pelos campos
reais do formulário) → "Salvar alterações" → mensagem "Alterações
salvas." → confirmado via `GET` direto no backend que as duas mudanças
feitas pela UI persistiram exatamente como preenchidas. Screenshots de
cada tela (lista, editor carregado, editor preenchido, confirmação de
salvo).

**Limpeza:** os registros de teste desta sessão (o criado via `curl` para
este PR, e o criado pelo wizard durante o teste do PR de renomeação/botão)
foram removidos do Guardian real de produção ao final — `search()` na
coleção `convergia_rondas` confirmado vazio depois. Nenhum dado sintético
ficou em produção. Servidores locais (`luna-core`/`luna-frontend`)
parados ao final.

### O que NÃO foi feito

- Painel de gestão completo (dashboard, filtro, gráfico) — decisão maior
  ainda pendente (P3 do documento de extensão do ADR-021), fora de
  escopo por pedido explícito.
- Exclusão de ronda inteira pela UI — decisão destrutiva separada, não
  pedida.
- Nenhum teste automatizado novo commitado no repositório (nem unitário
  de componente React — não existe suíte desse tipo aqui hoje — nem
  Playwright): os scripts de Playwright usados nesta sessão viveram fora
  do repositório (diretório de scratch), removidos ao final da sessão —
  não fazem parte do diff.
- `GENESIS/ROADMAP.md` não atualizado — vive em `Luna-context.md`, fora
  do escopo desta rodada (só `luna-frontend`/`luna-core`). ID confirmado
  para referência: **CONV-013** (ADR-021 Fase 1) — esta entrega é
  extensão dele, não item novo.
- Merge, "Ready for review" — branch segue draft, aguardando revisão.

---

## 2026-08-10 — Achado dinâmico: Etapa B por flags, foto original preservada localmente

**Contexto:** implementa as Decisões 1-3 da revisão de arquitetura
(`Luna-context.md`, `GENESIS/RESEARCH/
revisao-arquitetura-achado-dinamico-flags-foto.md`) do lado do cliente —
espelha os contratos novos de `luna-core` (mesma sessão, ver `BUILDER.md`
de lá: `id`/`flagId` no lugar de `categoria`, catálogo de flags, endpoint
de sugestão) e implementa a resposta do Architect à pendência de foto
original. Muda o wizard já em produção (Fase 1/CONV-013 + extensão de
edição) — Etapa B inteira redesenhada.

### O que foi entregue

1. **`lib/ronda/types.ts`** — `RondaFinding` troca `categoria` por
   `id`/`flagId`; `RISK_CATEGORY_LABELS` renomeado `FLAG_LABELS` (inclui
   `passivo_trabalhista`, que não tinha rótulo antes por não existir no
   código); `emptyFindings()` volta lista vazia (achado nasce do "+", não
   de slot fixo); novo `newFinding()`/`duplicateFinding()`;
   `pendingCategories` renomeado `pendingFindings`. Novos tipos
   `RondaFlag`/`RondaSuggestion`.
2. **`lib/ronda/api-client.ts`** — `getFlags()`/`getSugestoes(flagId)`,
   consumindo os dois endpoints novos de `luna-core`.
3. **`components/ronda/finding-card.tsx`** — título vem de
   `FLAG_LABELS[finding.flagId]` (ou "Achado manual"), não mais
   `categoria` fixa; novo botão "+ Duplicar" (Decisão 3, refinamento 3),
   visível só em achado já `identificado`; upload de foto agora também
   preserva o arquivo original (sem compressão) via
   `saveOriginalPhoto()`, em paralelo à versão comprimida que já ia pra
   `fotos[]`/fila.
4. **`components/ronda/ronda-wizard.tsx`** — Etapa B reescrita: catálogo
   de flags carregado de `GET /convergia/ronda/flags` no mount; cada flag
   é um checkbox (não radio, múltiplos marcáveis); marcar um flag de risco
   busca sugestões reais e mostra como botões "+ [texto do controle]";
   `passivo_trabalhista` (sem `bibliotecaRiscoId`) mostra só o "+" manual,
   sem tentar buscar sugestão. Lista de achados abaixo, um `FindingCard`
   por achado, endereçado por `id`. "+Achado avulso" pro terceiro tipo de
   "+" (manual, sem flag nenhum).
5. **`components/ronda/ronda-editor.tsx`** — endereça achado por `id`
   (`updateFinding`), ganha o mesmo "+Duplicar" do wizard.
6. **`lib/ronda/db.ts`** — novo object store `originalPhotos`
   (`DB_VERSION` 1→2, migração via `onupgradeneeded`, não destrutiva —
   store novo, `queue` intocado). `saveOriginalPhoto(achadoId, index,
   file)` grava o arquivo como veio (sem `lib/ronda/photo.ts`'s
   `compressPhoto`), associado ao achado por `achadoId`. Nunca faz parte
   do payload de `enqueueRonda`/`submitRonda` — só local,
   `getOriginalPhotosForFinding()` existe pra leitura (usado na
   verificação abaixo, não consumido por UI nesta rodada).

**Sobre a preocupação de cota do IndexedDB (pedida explicitamente na
instrução):** o teste de verificação abaixo usou uma foto sintética
minúscula (68 bytes), não representativa de uma foto real de celular
(tipicamente alguns MB). Não foi possível medir o impacto real de cota
neste ambiente (sem câmera real/arquivo de campo grande disponível) — é
uma lacuna real de verificação, registrada aqui em vez de assumida como
resolvida. Risco genuíno pra sessão futura avaliar: duas fotos por achado
(campo comprimida + original) em vez de uma só quase dobra o uso de
`IndexedDB` por ronda: pode valer a pena expirar/limpar originais já
enviados com sucesso, ou colocar um teto de retenção, mas isso não foi
pedido nem decidido nesta rodada.

### Verificação

1. `npm run typecheck` — limpo.
2. `npm test` — 34 testes (13 novos/reescritos em `types.test.ts` cobrindo
   `newFinding`/`duplicateFinding`/`pendingFindings`), todos passam.
   `db.test.ts` não precisou de mudança (só testa `summarizeQueue`, função
   pura).
3. `npm run test:constitution` — limpo (68 arquivos escaneados).
4. `npm run build` — sucesso (warnings pré-existentes de Edge Runtime em
   `jose`/`next-auth`, não relacionados a esta mudança).
5. **Ponta a ponta real, via Playwright, contra um `luna-core` local
   (mesmo backend desta sessão, rodando o código da branch irmã) e o
   Guardian real de produção** (rota nova, não deployada ainda — mesmo
   padrão já usado antes neste arquivo pra rotas novas):
   - Preencheu Etapa A, avançou.
   - Marcou o flag "Trabalho em Altura" → 3 sugestões reais carregadas
     (batendo com o confirmado em `luna-core`) → clicou na primeira → 1
     achado criado, pré-preenchido com a descrição da sugestão.
   - "+ Duplicar" no achado → 2 achados (mesmo `flagId`, campos
     copiados, `id` novo).
   - "+ Achado avulso (sem flag)" → 3 achados (`flagId: null`).
   - Upload de uma foto sintética no primeiro achado → **inspecionado
     `indexedDB` diretamente** (não assumido): store `originalPhotos`
     existe, 1 registro com `achadoId` batendo com o `id` do achado,
     `mimeType`/`sizeBytes` corretos — a foto original persiste local,
     como desenhado.
   - Preencheu os campos obrigatórios dos 3 achados, avançou pra Etapa C,
     clicou "Concluir" → salvo local (fila) → sincronizado com sucesso
     (sem erro 422/rede) → **confirmado via consulta direta ao banco de
     produção**: ronda real com os 3 achados persistidos exatamente como
     preenchidos (`jsonb_array_length(achados) = 3`).
   - **Registro de teste removido do banco real depois**
     (`delete from convergia_rondas where ronda_id = ...`, confirmado
     pela query retornando a linha apagada).
   - Scripts de Playwright viveram fora do repositório (diretório de
     scratch da sessão) — não fazem parte do diff, mesma convenção já
     usada antes neste arquivo.

### O que NÃO foi feito

- UI pra revisar/consultar as fotos originais preservadas
  (`getOriginalPhotosForFinding` existe, sem consumidor de UI) — não
  pedido nesta rodada, só a preservação em si.
- Envio da foto original pro servidor/quarentena — só local, como
  desenhado (`CONV-012` fora de escopo).
- Medição real de impacto de cota do IndexedDB com foto de tamanho real
  de celular — lacuna de verificação registrada acima, não resolvida.
- Leitura de imagem por IA (Fase 4) — fora de escopo, mesmo já registrado
  em `luna-core`.
- Mecanismo de "revisado, não se aplica" pra sugestão não convertida —
  pendência ainda não confirmada pelo Architect, fora do que foi pedido
  resolver aqui.

---

## 2026-08-10 — Fase 4 como fonte de sugestão (foto) + correção alimenta o Hipocampo

**Contexto:** implementa as Decisões 2-3 da revisão de arquitetura do lado
do cliente, depois da Parte 1 de verificação obrigatória (chamada real
contra produção, ver `BUILDER.md` de `luna-core`: `GROQ_API_KEY` válida,
`qwen/qwen3.6-27b` como modelo real, formato aceito, achado do "modo
thinking" e da cota apertada — 8000 TPM compartilhada, perto da saturação
nos testes).

### O que foi entregue

1. **`lib/ronda/types.ts`** — `RondaFotoSugestao` (descricao +
   classificacao/gravidade opcionais + `camposIncertos`),
   `SuggestionRecord`/`SuggestionOrigin`/`SuggestionCorrectionPayload`, e
   `diffSuggestionFields()` — compara o que foi sugerido com o que o
   humano salvou, só os campos que mudaram entram no delta.
2. **`lib/ronda/api-client.ts`** — `getFotoSugestao()` (nunca lança,
   `null` em qualquer falha — mesma política do lado do servidor) e
   `postCorrecaoSugestao()` (best-effort puro, erros engolidos).
3. **`finding-card.tsx`** — ao anexar foto, dispara
   `applyPhotoSuggestion()` em paralelo ao upload (não bloqueia): só
   preenche `descricao`/`classificacao`/`gravidade` se ainda estiverem
   vazios (nunca sobrescreve o que o humano já escreveu), sempre pelo
   `onChange` normal — nenhuma gravação automática. Campos em
   `camposIncertos` ganham destaque visual (borda âmbar + selo "IA não
   teve certeza — revise"), sem bloquear o preenchimento; o destaque some
   assim que o humano interage com aquele campo (clique na classificação,
   seleção de gravidade). Novo prop `onSuggestionApplied` reporta pro
   chamador quais campos a sugestão de fato preencheu, pra Parte 3.
   **Detalhe técnico real, não óbvio:** a leitura de foto é assíncrona e
   pode terminar depois de vários re-renders — um `ref` sincronizado a
   cada render garante que o merge da sugestão parte do valor mais
   recente do achado, não de um instantâneo desatualizado de quando o
   upload começou (evitaria sobrescrever uma edição feita enquanto a
   sugestão ainda carregava).
4. **`ronda-wizard.tsx`** — `suggestionOrigins` (estado local, por
   achado): grava o que uma sugestão de flag (Rodada 2) ou de foto (esta
   rodada) pré-preencheu. Na conclusão, compara cada achado com sua
   sugestão original via `diffSuggestionFields()` e dispara
   `postCorrecaoSugestao()` (fire-and-forget) só pros achados com delta
   real. `rondaId` usado é o `localId` da fila offline (`enqueueRonda`) —
   a ronda pode ainda não ter sincronizado com o servidor no momento da
   captura da correção; simplificação documentada, não um id de servidor
   real nesse caso.

### Verificação

1. `npm run typecheck` / `npm run build` — limpos.
2. `npm test` — 37 testes (3 novos cobrindo `diffSuggestionFields`,
   incluindo o caso "sugestão e valor salvo idênticos → delta vazio" e
   "campo nunca sugerido não entra no delta mesmo se preenchido depois").
3. `npm run test:constitution` — limpo.
4. **Ponta a ponta real contra produção, direto (sem UI)**, pelos
   endpoints que `luna-core` expõe — ver `BUILDER.md` de lá para o
   registro completo (payload real de sugestão com foto vermelha sólida,
   `camposIncertos` correto, correção persistida em `memoria_luna` real,
   confirmada e depois removida).
5. **UI real, via Playwright, contra o backend mockado na camada de rede
   do navegador com os payloads reais capturados no passo 4** (decisão
   deliberada: não repetir a chamada real à Groq só pra exercitar a UI —
   a cota de produção já estava apertada, confirmado na Parte 1; o que
   estava em risco aqui era a lógica do componente React, não o
   round-trip com a Groq, que já foi provado real em `luna-core`):
   - Achado avulso criado, foto sintética anexada → `descricao` da
     `textarea` pré-preenchida com o texto exato da sugestão mockada.
   - Os dois selos "IA não teve certeza — revise" (classificação e
     gravidade) apareceram, exatamente os dois campos que a sugestão
     real havia marcado incertos.
   - Corrigiu a descrição manualmente e selecionou classificação/
     gravidade → os dois selos de baixa confiança desapareceram
     (interação limpa o destaque).
   - Concluiu a ronda → **payload de `POST /convergia/ronda/
     correcao-sugestao` interceptado e inspecionado**: continha só
     `descricao` no delta (`sugerido` = texto da IA, `salvo` = texto do
     humano) — `classificacao`/`gravidade` corretamente ausentes do
     delta, porque nunca tinham sido sugeridas de verdade (a IA não
     preencheu, só marcou incerto; o humano preencheu do zero, não
     "corrigiu" nada que existia).
   - Script de Playwright viveu fora do repositório (scratch da sessão),
     mesma convenção já usada antes neste arquivo.

### O que NÃO foi feito

- Retry/backoff — mesma decisão do Architect registrada em `luna-core`:
  falha silenciosa, sem retry.
- Correção capturada na tela de edição (`ronda-editor.tsx`) — a sugestão
  de foto funciona lá também (mesmo `FindingCard`, mesmo componente), mas
  `suggestionOrigins`/captura de correção (Parte 3) só existe no wizard
  de criação; a edição não tem o contexto de "o que foi sugerido
  originalmente" pra um achado já salvo antes desta sessão. Não pedido
  explicitamente pra cobrir a edição — registrado como lacuna real, não
  escondida.
- `rondaId` real de servidor na correção — usa o `localId` da fila
  offline quando a ronda ainda não sincronizou; ver nota acima.
- UI pra revisar as fotos originais — já registrado como fora de escopo
  na entrada anterior, continua fora aqui.

---

## 2026-08-15 — /ronda: fundo em degradê, menu de Gravidade invertido, "×" pra remover achado

**Contexto:** três ajustes pequenos e independentes pedidos pelo
Architect, todos em `/ronda`. Nenhum depende dos outros.

### 1. Fundo escuro em degradê (quase preto → Midnight)

`components/ronda/theme-provider.tsx`: `dark:bg-[#1E2761]` (sólido) ganha
`dark:bg-[linear-gradient(180deg,#05060B_0%,#1E2761_100%)]` por cima. A
cor sólida **fica** como fallback — `background-color` e
`background-image` são propriedades distintas, então se o degradê não
pintar o fundo cai no Midnight de antes, nunca no fundo claro.

Escolhas, com a justificativa pedida:

- **Vertical (`180deg`), escuro no topo.** O cabeçalho (título,
  alternador de tema, botão de voltar), a barra de fila e os selos de
  estado ficam no topo — a faixa mais escura cai onde a densidade de
  texto é maior. Reforço real: `app/ronda/layout.tsx` declara
  `statusBarStyle: "black-translucent"`, ou seja, no iOS a barra de
  status do sistema se sobrepõe ao topo da página; quase preto ali é o
  que mantém os ícones do sistema legíveis.
- **`#05060B`, não `#000000`.** Mantém o mesmo viés azul do `#1E2761`,
  então a interpolação fica dentro de uma família de matiz só. Um quase
  preto neutro passaria por um meio-tom acinzentado no caminho.
- **Sem `background-attachment: fixed`.** Cogitado pra garantir que o
  degradê apareça igual em toda tela, e **descartado depois de medir**:
  as três telas (`ronda-wizard`, `ronda-editor`, `ronda-list`) são
  `min-h-dvh` com o scroll interno no `<main>`, não no documento. Medido
  via Playwright em todas as telas: `#ronda-root` tem altura 844 com
  viewport 844 e `document.scrollHeight <= innerHeight` — o elemento é
  sempre do tamanho da viewport, então o degradê já se repete igual
  sozinho. Evita de graça o `background-attachment: fixed`, que é
  justamente o que costuma falhar no Safari do iOS, alvo principal deste
  PWA.

**Modo claro não mudou** — confirmado por medição, não por inspeção
visual: `backgroundImage: "none"`, `backgroundColor: rgb(244, 246, 251)`
(`#F4F6FB`, idêntico ao de antes) em todas as telas claras.

### 2. `color-scheme` do menu de Gravidade invertido

`components/ronda/finding-card.tsx`: o `<select>` de Gravidade passa de
`[color-scheme:light] dark:[color-scheme:dark]` para
`[color-scheme:dark] dark:[color-scheme:light]`. Invertido, não
removido. É o **único `<select>` de todo o /ronda** (conferido) — nenhum
outro campo muda de comportamento.

**Nota de reconciliação, importante:** isto inverte, para este campo, a
decisão da entrada de 2026-08-06 deste mesmo arquivo ("`<select>`
nativos ilegíveis no popup"), que adicionou `color-scheme` justamente
pra o popup **acompanhar** a página. As duas decisões têm a mesma
motivação (legibilidade do menu aberto) e conclusões opostas: aquela
queria o popup se fundindo ao tema, esta quer ele contrastando com o
fundo. A instrução do Architect aqui foi explícita ("inverter, não
remover"), então a nova prevalece — registrado pra não parecer regressão
acidental de quem ler as duas entradas.

### 3. Botão "×" pra remover achado

`FindingCard` ganha `onRemove?: (findingId: string) => void` e um "×" no
cabeçalho, ao lado do "+ Duplicar". Diferente do "+ Duplicar", **não**
tem a condição `estado === "identificado"` — vale pra qualquer achado,
em qualquer estado, como pedido. `window.confirm()` nativo antes de
remover.

Ligado em `ronda-wizard.tsx` via `removeFinding`, que também descarta o
registro em `suggestionOrigins` do achado removido — mesmo princípio do
`setEstado` no próprio `FindingCard` (não guardar dado de um achado que
a pessoa decidiu não manter). O payload de correção já estaria a salvo
sem isso, porque `handleConclude` percorre `findings`, não
`suggestionOrigins`; a limpeza evita o registro órfão em memória.

### Verificado nesta sessão

- `npm run typecheck` — limpo.
- `npm run test:constitution` — passou, 68 arquivos varridos.
- `npm test` — 37/37 testes passando.
- **Playwright, com o backend stubado via `page.route()`** (catálogo de
  flags e sugestões; o `POST /convergia/ronda` interceptado pra
  inspecionar o payload). Viewport 390×844, script fora do repositório,
  mesma convenção das entradas anteriores:
  - **Degradê:** `linear-gradient(rgb(5, 6, 11) 0%, rgb(30, 39, 97)
    100%)` computado no `#ronda-root` em wizard (Etapa A e Etapa B) e
    histórico, no tema escuro; `none` nas mesmas telas no tema claro.
    Altura do elemento igual à da viewport nas três, documento sem
    scroll — que é a medição que dispensou o `bg-fixed`.
  - **Gravidade:** página `dark` → `<select>` com `color-scheme: light`;
    página `light` → `<select>` com `color-scheme: dark`. Invertido nos
    dois sentidos, como pedido.
  - **Campo fechado não regrediu:** cor do texto continua acompanhando o
    tema da página (`rgb(241, 245, 249)` no escuro, `rgb(15, 23, 42)` no
    claro), fundo transparente nos dois. A setinha desenhada pelo
    navegador continua visível nos dois temas — no Chromium ela deriva
    da propriedade `color`, que as classes explícitas controlam, e não
    do `color-scheme`; era o risco real dessa inversão e ele não se
    materializou. Recorte do campo capturado nos dois temas.
  - **Remoção:** dois achados criados → "×" com `confirm()` **cancelado**
    → continuam dois; "×" **aceito** → sobra um. Texto do diálogo
    conferido (`Remover o achado "Achado manual"? Não é possível
    desfazer.`). Ronda concluída até a tela final, e o **payload do
    `POST /convergia/ronda` interceptado**: `achados` traz só o achado
    mantido — o removido não é enviado.

**Não capturável:** o popup nativo do `<select>` aberto. Ele é desenhado
fora da árvore da página e abri-lo trava o `page.screenshot` do
Playwright. O que dá pra afirmar com evidência é o `color-scheme`
efetivo do elemento, que é a propriedade da qual o popup herda a cor —
a aparência do popup aberto em si não foi vista nesta sessão, e a
conferência final disso fica com o Architect no aparelho real.

### O que NÃO foi feito

- **"×" no `ronda-editor.tsx` — deliberadamente ausente, e é o achado
  mais importante desta sessão.** O editor de fato renderiza
  `FindingCard` (a instrução pedia pra confirmar antes de assumir que só
  o wizard precisava), mas o `PATCH /convergia/ronda/:id` faz **upsert
  por `id`** (`luna-core`, `src/convergia/ronda/ronda-store.ts`): `id`
  conhecido substitui aquele achado, `id` novo entra na lista, e não
  existe forma de o patch dizer "este achado saiu". Um "×" ali removeria
  o card, mostraria "Alterações salvas." e o achado voltaria no próximo
  carregamento — falha silenciosa numa ação destrutiva. Deixado de fora,
  com comentário no lugar onde a prop entraria explicando por quê.
  Habilitar depende de o contrato ganhar semântica de remoção em
  `luna-core` primeiro, o que é decisão do Architect.
- **Limpeza da foto original em IndexedDB ao remover um achado.**
  `saveOriginalPhoto` grava a foto não comprimida por `achadoId`
  (`lib/ronda/db.ts`) e não existe função de remoção — remover um achado
  com foto deixa o original órfão no IndexedDB do aparelho. Não é
  regressão desta mudança (o mesmo já acontece hoje ao voltar um achado
  pra "não avaliado"), mas o "×" torna o caso mais fácil de atingir.
  Fora do escopo de "três ajustes pequenos": exigiria API nova em
  `db.ts` mais teste. Registrado como lacuna real.
- Teste automatizado do `removeFinding`. A lógica verificada foi via
  Playwright, ponta a ponta; não foi adicionado teste unitário em
  `lib/ronda/__tests__/` porque a função vive no componente, não em
  `lib/` (que é o que a suíte atual cobre).

---

## 2026-08-15 — Fix urgente: `POST /convergia/ronda` 422 repetido em produção — fila offline reenviando pra sempre payloads de antes da migração pro achado dinâmico

### Achado, com logs reais

Logs HTTP de produção (Railway, `luna-core`) mostravam `POST /convergia/ronda`
retornando `422` repetidamente entre 2026-08-10 e 2026-08-15 (um único `201`
em toda a janela), sempre em rajadas rápidas (2–23ms de duração, várias
chamadas a poucos ms/segundos de distância) — padrão incompatível com um TST
preenchendo o wizard manualmente, compatível com uma fila reenviando vários
itens em sequência. A rajada mais recente (2026-08-15T08:55:06, dois `422`
~200ms um do outro) coincidiu exatamente com o print do Architect mostrando
"2 falharam" na fila local do wizard.

### Reprodução real (não assumida)

1. Wizard real (`/ronda`) preenchido via Playwright do jeito que um TST
   preencheria — Etapa A completa, um achado via sugestão de flag + foto, um
   achado manual + foto — rodado duas vezes contra `luna-core` local
   apontando pra produção real (`GUARDIAN_BASE_URL` de produção): **`201`
   nas duas vezes**, sem reproduzir um 422 no fluxo atual do wizard. Terceira
   variante testada direto por `curl` (achado `estado: "inexistente"` +
   achado manual `identificado`, mesma shape atual): também `201`. **Não há
   bug vivo no wizard atual** nos caminhos testados.
2. Payload sintético no formato **anterior** à migração pro achado dinâmico
   (`categoria` em vez de `id`/`flagId` — arquitetura de
   `Luna-context.md`/`GENESIS/RESEARCH/revisao-arquitetura-achado-dinamico-flags-foto.md`)
   enviado direto pro backend local (apontando pra produção real):
   ```
   POST /api/convergia/ronda
   {"metadata": {...}, "achados": [{"categoria": "trabalho_em_altura", "estado": "identificado", ...}, {"categoria": "eletricidade", "estado": "inexistente"}], "encerramento": {...}}
   ```
   Resposta real, capturada por completo (não só o status):
   ```
   HTTP 422
   {"error":"Envio de ronda reprovado na validação (2 problema(s)).","issues":[{"path":"achados.0.id","message":"Required"},{"path":"achados.1.id","message":"Required"}]}
   ```
   Reproduz exatamente o padrão dos logs de produção: rejeição rápida,
   estrutural, `id` ausente em cada achado.

### Causa raiz

`lib/ronda/queue.ts` (fila offline, `trySyncPendingRondas`) retentava
**qualquer** item `"pending"`/`"error"` em todo evento `online` e toda
reabertura do app, sem nenhuma forma de diferenciar uma falha de rede
(transiente, deve retentar) de uma rejeição estrutural do servidor
(permanente — o mesmo payload nunca vai passar). Itens enfileirados no
dispositivo do Architect **antes** da migração pro achado dinâmico (quando o
wizard ainda mandava `categoria`) ficaram presos: cada reconexão/reabertura
disparava um novo `422`, indefinidamente, contra o backend já migrado (que
corretamente exige `id`, ver `validation.ts` em `luna-core` — decisão
mantida, não alterada aqui: o contrato atual é o certo, o payload antigo é
que está desatualizado).

### O que mudou

1. **`api-client.ts`** — `RondaSubmitError` ganhou `status?: number` (status
   HTTP da resposta), pra quem trata o erro conseguir diferenciar 422
   (rejeição definitiva) de outras falhas.
2. **`db.ts`** — novo status de fila `"invalid"` (distinto de `"error"`):
   sinaliza um item que o servidor rejeitou por validação, não vai se
   resolver reenviando. `QueueCounts` ganhou `invalid`; nova
   `deleteQueueItem()` pra remover um item da fila local.
3. **`queue.ts`** — `isPermanentRejection(error)` (pura, testável): `true`
   só quando o erro é `RondaSubmitError` com `status === 422`. Em
   `trySyncPendingRondas`, uma rejeição permanente move o item pra
   `"invalid"` (nunca mais retentado automaticamente, mensagem clara pedindo
   pra refazer a ronda) em vez de `"error"` (que continua sendo retentado
   pra sempre — comportamento correto pra falha de rede real). Nova
   `discardInvalidQueueItem()` pra remover um item `"invalid"` depois que o
   usuário já refez a ronda manualmente.
4. **`use-ronda-queue.ts`** — expõe `discardInvalid(localId)`.
5. **`queue-status-bar.tsx`** / **`ronda-wizard.tsx`** — a barra de status
   agora mostra "N não pôde(ram) ser reenviada(s)" separado de "falhou(aram)",
   com um aviso explicando que é formato desatualizado (não vai se resolver
   sozinho) e um botão "Descartar" por item, listando título/data/mensagem
   de erro real de cada um.

### Sobre os registros que já falharam nestes dias

Confirmado via `GET /convergia/ronda` que **nenhum dos envios que geraram
422 foi persistido** (422 é rejeitado antes de qualquer escrita) — não há
dado real perdido no servidor, só as tentativas de reenvio na fila local do
dispositivo do Architect. Esses itens antigos, presos em IndexedDB no
formato pré-migração, **não são alcançáveis remotamente** — só o próprio
Architect pode limpá-los, no próprio aparelho. Com o fix, na próxima
reabertura do app eles vão parar de gerar 422 repetido: a fila vai
classificá-los como `"invalid"` (rejeição real do servidor, mesmo texto
`"achados.N.id": "Required"` capturado acima) em vez de continuar tentando
pra sempre, e a barra de status vai mostrar o aviso + botão "Descartar" —
não há migração automática de formato (a shape antiga usava `categoria`
fixa, que não existe mais no catálogo de flags dinâmico; não dá pra mapear
com segurança sem intervenção humana). Ação recomendada pro Architect:
abrir o wizard, ver o aviso laranja na barra de status, refazer manualmente
cada ronda antiga listada ali e descartar o item.

### Verificação

1. `npm run typecheck` — limpo.
2. `npm test` — 39 testes (2 novos: `isPermanentRejection` distingue 422 de
   erro de rede/5xx; `summarizeQueue` cobre o novo status `"invalid"`).
3. **Ponta a ponta real contra produção**, via Playwright no wizard real
   (`/ronda`), Etapa A completa + achado via sugestão de flag (com foto) +
   achado manual (com foto) — `201` confirmado, `GET /convergia/ronda/:id`
   confirmou os dois achados persistidos com os campos corretos
   (`id`/`flagId`, `estado: "identificado"`, fotos, etc.). Registro de teste
   removido depois (`delete from convergia_rondas where ronda_id = ...`,
   confirmado pela query retornando a linha apagada) — junto com os dois
   registros do mesmo teste rodado antes do fix (mesma rota, resultado
   idêntico, sem motivo pra manter duplicado).

### O que NÃO foi feito

- Migração automática do formato antigo (`categoria`) pro novo
  (`id`/`flagId`) — não é segura sem intervenção humana (ver acima); a
  solução aqui é parar o retry infinito + dar visibilidade/ação clara pro
  usuário, não inventar um mapeamento.
- Mudança no backend (`luna-core`) — a validação atual (exigir `id`) está
  correta pro contrato atual; decidido não "fazer o 422 sumir" mudando o
  que o servidor aceita.

---

## 2026-08-17 — Fix urgente: gate do wizard divergia do servidor — ronda do Sylvamo presa em campo com 6 problemas não nomeados e instrução contraditória

### Causa raiz

`pendingFindings` (o único gate que "Concluir ronda" checava) só olhava
`estado === "nao_avaliado"`. Não replicava `requiredWhenIdentified` de
`luna-core/src/convergia/ronda/validation.ts` — que exige `departamento`,
`classificacao`, `gravidade` e `descricao` em todo achado `identificado`.
Resultado real, capturado em campo (Sylvamo — LOGISTICA MG, turno B,
17/08 13:58): um achado com departamento vazio passou pelo wizard, subiu,
levou 422 ("Envio de ronda reprovado na validação (6 problema(s))."), e a
tela de edição da fila (`ronda-editor.tsx`) não mostrava quais 6 —
só o texto genérico do servidor, seguido por duas instruções que se
contradiziam: "Refaça esta ronda e descarte este item da fila" (herdada
do fix de 15/08, que só se aplica a payload pré-migração sem `id`) ao
lado de "Corrija o que estiver faltando abaixo e salve" (hardcoded,
sempre mostrada, mesmo quando a primeira instrução já mandou descartar).

### O que mudou

1. **`lib/ronda/types.ts`** — `missingRequiredWhenIdentified(finding)`,
   espelho de `requiredWhenIdentified` do servidor (mesmos 4 campos, foto
   fora de propósito, em todo estado). `findingsWithMissingFields(findings)`
   agrega pra UI. `findingTitle(finding)` extraído do que já existia em
   `FindingCard` (flag ou "Achado manual"), reaproveitado no aviso da
   Etapa C.
2. **`ronda-wizard.tsx`** — `canConclude` passa a exigir também
   `findingsWithMissingFields(findings).length === 0`. O aviso da Etapa C
   lista cada achado incompleto nomeado, com os campos por extenso
   ("Achado manual — falta departamento e descrição"), nunca uma
   contagem.
3. **`finding-card.tsx`** — os 4 campos obrigatórios ganham a mesma
   marcação âmbar que a Fase 4 já usa para `camposIncertos` (nenhum
   padrão novo) enquanto vazios num achado `identificado`. Novo prop
   opcional `serverIssues` (campo → mensagem real do servidor) sobrepõe o
   texto genérico quando disponível. Duplicar um achado incompleto
   (`+ Duplicar`, de 15/08) preserva os campos faltando — coberto em
   teste, não é caso especial em lugar nenhum do código.
4. **`lib/ronda/issues.ts`** (novo) — `parseIssuePath` traduz
   `achados.{id}.{campo}` (separando pelo **último** ponto, não o
   primeiro — sobrevive a um id de achado que contenha ponto);
   `mapIssuesToFindings` agrupa por achado + lista o que não mapeia
   (metadado, achado que não existe mais localmente); `isOldFormatRejection`
   decide "formato antigo, irrecuperável" (issue em `.id`, ou nenhuma
   issue guardada) vs. "campo faltando, recuperável".
5. **`api-client.ts`** — `RondaSubmitError.issues` tipado com o
   `ValidationIssue` novo (já existia como shape inline; não mudou
   comportamento, só nomeou o tipo pra `db.ts` reaproveitar).
6. **`db.ts`** — `QueueItem.issues?: ValidationIssue[]`, gravado junto do
   `lastError`. Sem bump de `DB_VERSION`: é campo novo opcional num
   registro já existente, não store/index novo — IndexedDB não tem
   schema por campo, então nenhuma migração é necessária pra um item
   antigo (sem `issues`) continuar válido. `updateQueueSubmission` limpa
   `issues` junto do `lastError` — mesma lógica que já limpava o segundo.
7. **`queue.ts`** — `lastError` deixou de embutir a instrução ("refaça e
   descarte"/"corrija e salve"); guarda só o que aconteceu. A decisão do
   que dizer passou pra `ronda-editor.tsx`, que tem o que
   `queue.ts` não tem: o conteúdo carregado (pro gate do cliente) e,
   quando disponível, as `issues` do servidor.
8. **`ronda-editor.tsx`** — a contradição virou uma escolha: `isOldFormat`
   é `true` só quando o gate do cliente (`findingsWithMissingFields` sobre
   o `findings` já carregado) não acha nada de faltando **e**
   `isOldFormatRejection(queueIssues)` também não acha sinal de campo
   recuperável — nessa ordem, de propósito: um item `"invalid"` de antes
   desta correção não tem `issues` guardada, e é o gate do cliente sozinho
   quem resolve esse caso (não precisa do servidor ter falado nada).
   Formato antigo mostra "não dá pra recuperar, descarte"; campo faltando
   mostra "corrija abaixo e salve" — nunca as duas juntas. Issues que não
   mapeiam pra um achado da ronda carregada aparecem numa lista própria,
   com o texto do servidor. Cada `FindingCard` recebe as issues do próprio
   achado via `serverIssues`. Nenhum botão de descartar foi removido nem
   escondido (regra do pacote: só acréscimo) — o existente já avisa
   claramente que a ronda não enviada se perde.

### Verificação

1. `pnpm typecheck`, `pnpm test` (72/72 — todos os 56 anteriores intactos,
   16 novos: `missingRequiredWhenIdentified`/`findingsWithMissingFields`
   em `types.test.ts`, `parseIssuePath`/`mapIssuesToFindings`/
   `isOldFormatRejection` em `issues.test.ts`, novo), `pnpm run
   test:constitution`, `pnpm build` — todos limpos neste ambiente.
2. **Ponta a ponta real, via Playwright contra o wizard real (`/ronda`,
   `pnpm dev` local com `NEXT_PUBLIC_LUNA_GATEWAY_BASE_URL` apontado pro
   Gateway de produção)**: Etapa A completa, achado manual com
   classificação/gravidade/descrição preenchidas e departamento vazio de
   propósito → "Concluir LUNA Safety Walk" confirmado **desabilitado**,
   aviso confirmado com o texto exato "Achado manual — falta
   departamento". Preenchido o departamento → botão confirmado
   **habilitado**. Este trecho não depende de rede (o gate roda inteiro
   no cliente) e rodou de ponta a ponta no navegador real.
3. **Achado neste ambiente, registrado com honestidade**: o Chromium
   deste sandbox não conseguiu alcançar hosts externos (Railway) nem
   configurando `--proxy-server` pro proxy do agente — `curl`/`fetch` do
   Node atravessam o proxy normalmente (confirmado, `GET
   /convergia/ronda/flags` via curl funcionou), mas o processo do
   Chromium recebe `ERR_CONNECTION_RESET` mesmo com a mesma URL, sem
   nenhuma falha registrada em `/__agentproxy/status` — o pedido não
   chega a sair do processo do navegador. Não foi possível, portanto,
   observar o `POST /convergia/ronda` disparado pelo clique real no botão
   "Concluir" neste ambiente (o texto "Já confirmado no servidor" na tela
   de sucesso do wizard, nesse teste, refletia `counts.pending` de
   **antes** do enfileiramento, não uma confirmação real — não
   confiar nesse texto como prova de envio; comportamento pré-existente
   do hook de fila, não alterado por este pacote, fora de escopo aqui).
4. **A parte de rede foi verificada do mesmo jeito que o fix de
   15/08 já validou o formato antigo: `curl` direto contra o Gateway de
   produção real** (`uvicorn-main-production-92f8.up.railway.app`), com
   um achado `identificado` no mesmo shape que o wizard produz
   (`id`/`flagId`/`estado`/campos). Sem `departamento`: `422`,
   `issues: [{"path":"achados.<id>.departamento","message":"departamento
   é obrigatório quando o risco foi identificado"}]` — confirma que
   `missingRequiredWhenIdentified` no cliente aponta exatamente o que o
   servidor aponta. Com `departamento`: `201`,
   `ronda_d56bf057-f0a5-4464-be52-1c39145bb4b8`. Confirmado persistido via
   consulta direta ao Supabase do projeto real (`jdbzhrtovpoaafpytgza` —
   não o projeto `luna-safety-walk-piloto`, que está com
   `convergia_rondas` vazio e não é o que o Gateway de produção realmente
   usa; achado incidental desta verificação, não investigado além disso,
   fora de escopo). Registro de teste removido depois (`delete from
   convergia_rondas where ronda_id = '...' returning ronda_id`, linha
   devolvida confirmando a exclusão; contagem da tabela conferida antes/depois,
   2 rondas reais preservadas).

### O "portão real" (ADR desta sessão) — NÃO verificado, e por que

O pacote de origem é explícito: "o Arquiteto abre o aparelho, entra na
ronda do Sylvamo, vê os campos acesos, preenche, salva, e a ronda sobe.
Enquanto essa ronda não subir, esta etapa não está feita." Isso é uma
ação humana, no aparelho físico do Architect, fora do alcance desta
sessão (sem acesso a esse dispositivo). **Não fazer essa afirmação aqui.**
O que este pacote garante, e que foi de fato confirmado nesta sessão: (1)
o gate do cliente aponta os mesmos campos que o servidor exige, incluindo
sobre o conteúdo já carregado de um item `"invalid"` sem `issues`
guardada (Etapa 1, testado); (2) uma vez que o Architect preencha os
campos acesos e clique "Salvar e enviar" na tela de edição da fila, o
payload resultante passa a validação do servidor real (confirmado via
`curl` idêntico, item 4 acima). A confirmação de que a ronda real do
Sylvamo de fato subiu depende de o Architect abrir o aparelho — ação de
campo, não de código, e portanto não incluída nesta autoatestação.

### O que este pacote NÃO faz

- Não afrouxa a validação do servidor (`luna-core` inalterado).
- Não torna foto obrigatória, em nenhum estado — travado em teste.
- Não migra formato antigo — `isOldFormatRejection` reconhece, não
  converte.
- Não limpa foto original órfã no IndexedDB — segue aberta, já registrada
  em 15/08.
- Não toca em `app/forge/`, `components/forge/`, `app/page.tsx`.
- Não remove nem esconde o botão "Descartar esta ronda do aparelho" já
  existente em `ronda-editor.tsx` — continua disponível pra qualquer
  status de fila, com o mesmo aviso de confirmação que já tinha.

  **Correção do parágrafo acima, ver entrada de 2026-08-18 logo abaixo:**
  o botão passou a ficar escondido quando a rejeição é recuperável.
  Decisão revista depois de comparar com a branch irmã (`#29`, superada)
  e a revisão de código sobre as duas.

---

## 2026-08-18 — Ronda presa em campo, parte 2: esconde "Descartar" quando a rejeição é recuperável, corrige o caso de payload misto

### Contexto

Três sessões chegaram, de forma independente, na mesma correção (gate do
cliente divergindo de `requiredWhenIdentified`) entre 18:27 e 19:04 de
17/08 — PRs `#28`, `#29` e `#30` deste repositório. Uma revisão comparando
os três (relatório externo a esta sessão, "Situação de PR e merge —
17/08/2026, 21h") recomendou `#30` como base — é o único com verificação
`curl` real contra o Gateway de produção (422→201, linha do Supabase
contada e removida) — e portar duas coisas de `#29` que `#30` não tinha:
esconder "Descartar esta ronda do aparelho" quando a rejeição é
recuperável, e um achado adicional da própria revisão sobre como essa
checagem deveria funcionar num payload misto.

### O que mudou

**`lib/ronda/issues.ts`** — nova `canDiscardInvalidItem(achados, issues)`.
Deliberadamente mais conservadora que `isOldFormatRejection` (que decide só
a *mensagem* — "formato antigo" vs. "corrija os campos"): `isOldFormatRejection`
usa `.some()`, então basta **uma** issue em `achados.N.id` pra classificar o
422 inteiro como formato antigo, mesmo que **outra** issue do mesmo 422
aponte pra um campo de um achado que ainda está na lista carregada — um
payload misto assim ainda tem o que corrigir editando o achado. A mensagem
continua "formato antigo" (a explicação técnica exata não muda); a
permissão de descartar, não — `canDiscardInvalidItem` só devolve `true`
quando não há **nada** corrigível: nem o gate do cliente sobre o conteúdo
já carregado (`findingsWithMissingFields`), nem uma issue do servidor que
mapeia pra um campo de um achado que ainda existe na lista
(`mapIssuesToFindings(...).byFinding`).

Usada em **`ronda-editor.tsx`** (esconde "Descartar esta ronda do
aparelho" quando `queueStatus === "invalid"` e não há nada corrigível) e em
**`queue-status-bar.tsx`** (mesma checagem por item na lista agregada de
itens rejeitados; o parágrafo agregado deixou de afirmar "provavelmente
formato antigo" como única causa possível).

### Verificação

1. `npm run typecheck` / `npm run test:constitution` / `npm run build` —
   limpos.
2. `npm test` — **75/75** (72 pré-existentes intactos, nenhum alterado; 3
   novos em `issues.test.ts`, cobrindo especificamente o caso misto: uma
   issue de campo real + uma de `achados.N.id` no mesmo 422 →
   `canDiscardInvalidItem` continua `false`, mesmo com `isOldFormatRejection`
   `true`).
3. **No navegador, via Playwright (Chromium local) contra o wizard e o
   editor deste repo**: item `"invalid"` seedado direto no IndexedDB com o
   payload misto exato do teste acima → banner mantém "Não dá para
   recuperar — formato antigo" (mensagem preservada, como pretendido),
   botão "Descartar esta ronda do aparelho" confirmado **ausente**, e a
   mensagem real do servidor ("departamento é obrigatório quando o risco
   foi identificado") confirmada visível no campo. Registro sintético só
   em IndexedDB do navegador de teste, processo efêmero — nunca tocou
   `luna-core` nem qualquer banco real.

### O que este pacote NÃO faz

- Não muda a heurística de `isOldFormatRejection` nem o texto da
  mensagem — só a permissão de oferecer "Descartar".
- Não fecha `#29` nem mexe em `#28` — decisões de PR, fora do escopo de
  um commit de código.
- Mesmas ressalvas da entrada de 17/08 acima (validação do servidor
  inalterada, foto nunca obrigatória, formato antigo não migrado, `app/forge/`
  e `components/forge/` intocados).

---

## 2026-08-18 — Compressão de foto em paralelo descartava a aba antes do upload; correção de diagnóstico do pacote anterior

### Achado real — não o que o pacote original descrevia

Um pacote anterior ("a Camada 2 desligou a leitura de imagem sem ninguém
notar") diagnosticava a sugestão por IA como desligada no caminho com rede,
inferindo isso da mensagem do commit da Camada 2 (16/08) em vez de ler a
chamada. **Essa leitura estava errada** — confirmado nesta sessão e pelo
próprio Engenheiro depois: `components/ronda/finding-card.tsx`,
`handlePhotoChange`, tem

```ts
void photoToBase64(compressed[0])
  .then((photo) => applyPhotoSuggestion(photo))
  .catch(() => undefined);
```

fora do laço de upload, fora de qualquer condicional — dispara sempre, com
ou sem rede. A sugestão por foto nunca esteve quebrada. O pacote foi
retirado; esta entrada registra a correção de diagnóstico, não só a de
código, porque o erro (inferir do texto do commit em vez de abrir a
função) é o tipo de achado que vale mais que a correção em si.

**Duas hipóteses eliminadas nesta sessão, sem código:**
- *Cache do service worker servindo bundle antigo do `#30`* — descartada:
  as rondas que estavam presas na fila do aparelho real do Arquiteto
  subiram e a fila esvaziou, o que só acontece com o gate novo em
  produção.
- *Sugestão por foto desligada com rede* — descartada, ver acima.

### O bug real, encontrado uma linha acima do que o pacote retirado apontava

Relato de campo, textual: *"a foto não sobe, sai do app"*. Mesma função,
`handlePhotoChange`:

```ts
const compressed = await Promise.all(fileList.map(compressPhoto));
```

O `<input>` é `multiple`. `compressPhoto` decodifica cada foto em
resolução plena (`new Image()` + `drawImage` num `<canvas>`) antes de
reduzir a 1280px — três fotos de 12MP em paralelo somam ~147MB de bitmap
RGBA simultâneos, mais os `File` originais retidos para o upload logo
depois. Memória suficiente para o navegador móvel descartar a aba **no
meio da compressão**, antes de `uploadFoto` sequer ser chamado — sem erro
na tela (a Promise nunca resolve nem rejeita, a aba já não existe), sem
falha de rede, sem nada em log de servidor. "A foto não sobe" e "sai do
app" são o mesmo evento, não dois sintomas.

### O que mudou

**`components/ronda/finding-card.tsx`** — única mudança: o `Promise.all`
que decodificava todas as fotos selecionadas em paralelo virou um laço
sequencial (`for` com `await` por arquivo). No máximo um bitmap de
resolução plena na memória por vez, em vez de N simultâneos. Comentário
no código explica o porquê (não óbvio sem o contexto de campo).

Isolado, de propósito — nada mais tocado nesta entrada:
- **Não** trocado `new Image()`/`canvas` por `createImageBitmap` com
  `resizeWidth`/`resizeHeight` (decodificaria já reduzido, sem o pico de
  memória de resolução plena) — melhoria real, mas é mudança de
  mecanismo de decodificação, não a causa raiz mínima; fica pra um PR
  próprio.
- **Não** movida a sugestão por foto para usar `fotoId` em vez de
  base64 — motivo é economia de memória, não correção de um bug (a
  sugestão nunca esteve quebrada, ver acima); e mexer nisso sem o
  caminho por id já existir no servidor quebraria a sugestão de
  verdade, criando o bug que o pacote anterior descreveu por engano.
- **Não** adicionada instrumentação de início/fim de compressão no
  IndexedDB — fica pra quando a correção de decodificação reduzida
  entrar, que é quando esse contador teria mais valor.

### Verificação

1. `npm run typecheck` — limpo.
2. `npm test` — **75/75**, nenhum teste alterado (o mesmo total de antes
   desta mudança — a correção não adiciona nem quebra caminho de teste
   algum; a suíte atual não tem teste de compressão de imagem real,
   que dependeria de `<canvas>`/`Image` em ambiente DOM completo).
3. `npm run test:constitution` — limpo (77 arquivos).
4. `npm run build` — limpo.
5. **Não verificado nesta sessão**: reprodução real do descarte de aba
   sob pressão de memória (exigiria um dispositivo móvel real com fotos
   de 12MP e memória limitada — não reproduzível neste ambiente
   sandboxed) e a confirmação em produção de que 3 fotos simultâneas não
   derrubam mais a aba. **Portão real**: o Arquiteto anexar 3 fotos de
   uma vez numa ronda real e todas subirem, sem a aba fechar. Enquanto
   isso não acontecer, esta etapa não está confirmada — só o mecanismo
   que deveria resolver o problema está no código.
6. Sem acesso ao Railway nesta sessão (confirmado pelo Engenheiro,
   tentativa própria retornou 403) — nenhuma verificação contra produção
   foi tentada aqui, como instruído.

### O que este pacote NÃO faz

- Não implementa decodificação já reduzida (`createImageBitmap`) — PR
  próprio, listado acima.
- Não move a sugestão por foto para `fotoId` — PR próprio, e só depois
  do endpoint por id existir no servidor.
- Não adiciona contador/instrumentação de compressão.
- Não toca `app/forge/`, `components/forge/`, `app/page.tsx`.
- Não mexe na branch do `#29` (fechada, não mergeada, `mergeable_state:
  behind`, superada pelo `#30`) — este trabalho partiu de `origin/main`
  limpo, confirmado por `git merge-base origin/main HEAD` batendo com a
  ponta de `origin/main` antes de qualquer commit.

---

## 2026-08-19 — Fechar a câmera: três PRs, com autorização de merge

Pacote fechado em sequência — `#31` (compressão sequencial, já descrito
acima), depois PR 1 (`#33`, dois caminhos de foto), PR 2 (`#34`,
decodificação já reduzida), PR 3 (instrumentação mínima). Autorização
explícita do Arquiteto: mergear cada PR após os próprios portões
automáticos, com o portão de campo verificado **depois** do merge — troca
aceitável porque as três mudanças são aditivas, o único usuário é o
Arquiteto, e a ronda usada em campo agora é banco de teste.

### Dado novo que motivou o pacote

Depois do `#32` (que removeu `capture="environment"` para recuperar
galeria/panorâmica), no aparelho real do Arquiteto: sem `capture`, o
Android decidiu ir direto para a galeria de fotos, sem seletor — em vez do
gerenciador de arquivos observado antes. Confirma o diagnóstico do `#32`
(a ausência de `capture` deixa a escolha do que abrir inteiramente a cargo
do sistema) e a necessidade do PR 1: os dois caminhos, lado a lado, tiram
essa loteria de cima do usuário.

### PR 1 — dois caminhos de foto (`#33`)

`components/ronda/finding-card.tsx` ganhou dois inputs ocultos e dois
botões — "Tirar foto" (`capture="environment"`, toque único) e "Escolher"
(sem `capture`, seletor completo) — com um `ref` cada e o mesmo
`handlePhotoChange`. Comentário no código para a duplicação não parecer
descuido de uma sessão futura.

Duas correções incluídas no mesmo PR: `protecao_contra_incendios` faltava
em `FLAG_LABELS` (aparecia como chave crua na Etapa 2); a mensagem de
recuperação de rascunho garantia que nada se perdeu, exatamente no caso em
que uma foto em processamento se perde numa queda do app — agora pede
conferência em vez de garantir o que não há como saber.

Durante a implementação, `#31` (compressão sequencial, já em rascunho e
verificado) foi mergeado primeiro, como instruído — o rebase de PR 1 por
cima dele foi automático, sem conflito real (arquivos tocados são
adjacentes na mesma função, não sobrepostos).

### PR 2 — decodificar já reduzido (`#34`)

`lib/ronda/photo.ts`: `parseImageDimensionsFromHeader` lê largura/altura
direto dos primeiros 64KB do arquivo (marcador `SOF` do JPEG, `IHDR` do
PNG) sem decodificar. Com a dimensão em mãos, `compressWithImageBitmap`
usa `createImageBitmap` informando só o lado maior (`resizeWidth` ou
`resizeHeight`, nunca os dois) — o navegador calcula o outro preservando
proporção — com `imageOrientation: "from-image"` obrigatório e
`OffscreenCanvas` quando disponível. `bitmap.close()` logo após desenhar;
canvas zerado ao final. Teto por proporção: 1280px até 2,5:1, 2000px acima
disso (panorâmica). Cabeçalho não reconhecido, truncado, ou
`createImageBitmap` falhando: cai no caminho antigo, preservado.

Testes novos, função pura: teto por proporção (padrão e panorâmica) e
parse de cabeçalho (JPEG válido, PNG válido, truncado, formato não
reconhecido) — 6 testes, `lib/ronda/__tests__/photo.test.ts`.

### PR 3 — instrumentação mínima (`#35`)

Novo store IndexedDB (`diagnostics`, `db.ts` v4→v5) grava eventos do
pipeline de foto — compressão iniciada/concluída, upload
pedido/concluído/falhou, sugestão pedida/respondida/falhou — cada um
carimbado com `sessionId` (uma por abertura do app) e `correlationId` (id
da foto para compressão/upload, id do achado para sugestão).

O evento "started"/"requested" é gravado com `await` (não `void`) *antes*
de a operação arriscada começar — é essa gravação, já confirmada em
disco, que sobrevive à aba sendo descartada no meio. `lib/ronda/photo.ts`
ganhou `width`/`height` em `CompressedPhoto` e exportou `readImageDimensions`
só para a instrumentação registrar a dimensão sem decodificar de novo —
nenhuma mudança na lógica de compressão em si.

`lib/ronda/diagnostics.ts` concentra a parte pura (testável sem
IndexedDB): `hasOrphanedStart` (algum início sem fim pelo mesmo
`correlationId`), `summarizeCompressions`, `lastCompletedSessionSummary`
(a sessão anterior mais recente — nunca a atual, que ainda está em
andamento) e `selectDiagnosticEventKeysToDiscard` (mantém a sessão atual,
a última anterior, e qualquer sessão com início órfão; descarta o resto —
mesmo princípio de "diagnóstico não é histórico" já aplicado uma vez às
fotos originais em `discardRondaLocalCopies`). 8 testes novos,
`lib/ronda/__tests__/diagnostics.test.ts`.

`components/ronda/ronda-list.tsx` ("Ver rondas anteriores") lê e limpa
uma vez por montagem, mostra uma linha discreta — "Sessão anterior: N/M
compressões de foto concluídas", com aviso só se M < N. Sem painel, sem
gráfico, como pedido.

### Verificação

1. `npm run typecheck`, `npm test`, `npm run test:constitution`,
   `npm run build` — limpos nos três PRs, cada um verificado antes do
   commit e de novo (CI) antes do merge.
2. `npm test`: 75 (ponto de partida) → 81 (PR 2, +6) → 89 (PR 3, +8).
   Nenhum teste anterior alterado em nenhum dos três.
3. `git merge-base origin/main HEAD` batendo com a ponta de `origin/main`
   confirmado antes do primeiro commit de cada branch — inclusive depois
   do rebase de PR 1 sobre o `#31` recém-mergeado.
4. **Não verificado nesta sessão** (comportamento real de navegador
   móvel, sem substituto em CI): `createImageBitmap`/`canvas`/`capture`
   em dispositivo real, orientação EXIF de foto real, e o gate de campo
   descrito abaixo. Por autorização do Arquiteto, os três PRs foram
   mergeados antes dessa verificação — ela acontece depois, não antes.

### Gate de campo — pendente, verificação pós-merge

1. Dois botões aparecem no card do achado.
2. "Tirar foto" abre a câmera direto.
3. "Escolher" dá galeria e o aplicativo de câmera completo, com
   panorâmica.
4. Tirar uma foto pela câmera não fecha o app.
5. Anexar uma panorâmica funciona e o detalhe fica legível no relatório.

Se o item 4 ainda falhar depois do PR 2, o registro do PR 3 (linha "Sessão
anterior" em "Ver rondas anteriores", ou consulta direta ao store
`diagnostics`) vai mostrar uma compressão iniciada sem concluída — dado, não
suposição, ao contrário do que essa mesma investigação tinha antes desta
instrumentação existir.
