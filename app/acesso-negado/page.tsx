import Link from "next/link";

export const metadata = {
  title: "Acesso restrito — LUNA",
};

/**
 * `2026-08-19-acesso-publico.md`, Etapa 2 — página de erro própria do
 * Auth.js (`auth.ts`, `pages.error`). Antes disto, um visitante que caía
 * aqui (ex.: família do Arquiteto tocando o "Dev Mode →" por curiosidade)
 * via a tela de erro padrão do NextAuth: um beco sem saída só com "Entrar",
 * que devolve pro mesmo lugar, e o nome técnico do erro na cara — nenhuma
 * das duas coisas faz sentido pra quem não veio depurar nada.
 *
 * De propósito sem mostrar o `?error=` da URL — visitante não precisa saber
 * qual foi a causa técnica, só que a área é restrita e como voltar.
 */
export default function AcessoNegadoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold text-luna-textSub">Esta área é restrita</h1>
        <p className="text-sm text-luna-textMuted">
          Essa parte do site é de acesso limitado. Não há nada de errado — o link só leva a
          uma área que não é para o público em geral.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-luna-textSub backdrop-blur-md hover:text-luna-cyanHi"
        >
          ← Voltar ao site
        </Link>
        <Link
          href="/api/auth/signin"
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-luna-textSub backdrop-blur-md hover:text-luna-cyanHi"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
