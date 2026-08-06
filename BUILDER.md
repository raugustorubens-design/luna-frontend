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
