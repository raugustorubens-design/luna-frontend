/**
 * Os cinco estágios, na ordem. A ordem é o conteúdo: cada etapa só pode falar
 * com a seguinte, e é isso que impede a memória de ser escrita por qualquer
 * lugar do sistema.
 */
const STAGES = [
  {
    n: "01",
    name: "Entrada",
    line: "Uma pergunta no chat, uma ronda enviada do celular ou uma planilha jogada no Convergia.",
  },
  {
    n: "02",
    name: "Gateway",
    line: "Registra, autoriza e audita o que pode ser executado. Nenhuma ação passa por fora daqui.",
  },
  {
    n: "03",
    name: "Motor cognitivo",
    line: "Recupera memória, monta o contexto e escolhe o provedor. Não persiste nada por conta própria.",
  },
  {
    n: "04",
    name: "Hipocampo",
    line: "Decide o que merece virar memória. Descarta repetição e ruído antes de gravar.",
  },
  {
    n: "05",
    name: "Memória",
    line: "Grava no Supabase com vetor semântico. Único ponto do sistema que escreve no banco.",
  },
];

export function Pipeline() {
  return (
    <section id="pipeline" className="border-b border-[var(--luna-line)] py-[clamp(4rem,9vw,7rem)]">
      <div className="mx-auto w-full max-w-[1240px] px-[var(--luna-pad)]">
        <div className="luna-reveal mb-11 flex flex-wrap items-baseline gap-5">
          <h2 className="text-[length:var(--luna-step-3)]">O caminho de uma pergunta</h2>
          <p className="max-w-[46ch] text-[length:var(--luna-step--1)] text-[var(--luna-text-2)]">
            A ordem importa: cada etapa só pode falar com a seguinte. É isso que impede a memória de
            ser escrita por qualquer lugar do sistema.
          </p>
        </div>

        <ol className="luna-reveal grid list-none gap-px overflow-hidden rounded-[var(--luna-radius)] border border-[var(--luna-line)] bg-[var(--luna-line)] p-0 sm:grid-cols-3 lg:grid-cols-5">
          {STAGES.map((stage) => (
            <li
              key={stage.n}
              className="flex flex-col gap-2 bg-[var(--luna-bg)] px-5 py-6"
            >
              <span className="font-[family-name:var(--luna-mono)] text-[0.6875rem] tracking-[0.1em] text-[var(--luna-accent)]">
                {stage.n}
              </span>
              <h4 className="text-[length:var(--luna-step-0)]">{stage.name}</h4>
              <p className="text-[0.8125rem] leading-[1.5] text-[var(--luna-text-3)]">
                {stage.line}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
