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
