import { NextResponse } from "next/server";
import { commitAllLocalChanges } from "@/lib/forge/git";

// Forge MVP-06 — commit local sob a credencial de serviço do próprio
// servidor (git identity já configurada no ambiente), nunca a de um agente
// de chat. Ver nota em lib/forge/git.ts.
export async function POST(request: Request) {
  const workingDirectory = process.env.FORGE_WORKING_DIRECTORY ?? process.cwd();
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Mensagem de commit obrigatória." }, { status: 400 });
  }

  try {
    const result = await commitAllLocalChanges(workingDirectory, message);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao commitar." }, { status: 500 });
  }
}
