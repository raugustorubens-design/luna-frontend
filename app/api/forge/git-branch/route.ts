import { NextResponse } from "next/server";
import { createLocalBranch } from "@/lib/forge/git";

// Forge MVP-06 — cria e troca de branch localmente. Não fala com o GitHub;
// a branch só existe remotamente depois de um push (botão separado).
export async function POST(request: Request) {
  const workingDirectory = process.env.FORGE_WORKING_DIRECTORY ?? process.cwd();
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";

  try {
    const status = await createLocalBranch(workingDirectory, name);
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao criar branch." }, { status: 400 });
  }
}
