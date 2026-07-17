import { NextResponse } from "next/server";
import { pullCurrentBranch } from "@/lib/forge/git";

// Forge MVP-06 — pull sob a credencial de serviço do próprio servidor
// (git remote já configurado no ambiente), nunca a de um agente de chat.
// Ver nota em lib/forge/git.ts.
export async function POST() {
  const workingDirectory = process.env.FORGE_WORKING_DIRECTORY ?? process.cwd();
  try {
    const result = await pullCurrentBranch(workingDirectory);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao dar pull." }, { status: 500 });
  }
}
