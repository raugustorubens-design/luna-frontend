import { NextResponse } from "next/server";
import { pushCurrentBranch } from "@/lib/forge/git";

// Forge MVP-06 — push sob a credencial de serviço do próprio servidor
// (git remote já configurado no ambiente), nunca a de um agente de chat.
// Ver nota em lib/forge/git.ts.
export async function POST() {
  const workingDirectory = process.env.FORGE_WORKING_DIRECTORY ?? process.cwd();
  try {
    const result = await pushCurrentBranch(workingDirectory);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao dar push." }, { status: 500 });
  }
}
