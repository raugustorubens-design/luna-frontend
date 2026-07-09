import { NextResponse } from "next/server";
import { readLocalGitStatus } from "@/lib/forge/git";

// Mesmo fallback que server.ts usa para o terminal (FORGE_WORKING_DIRECTORY
// ?? process.cwd()) — sem isso, quando FORGE_WORKING_DIRECTORY está
// configurado, o painel de Contexto mostrava branch/commit de um diretório
// diferente do que o terminal realmente usa.
export async function GET() {
  const workingDirectory = process.env.FORGE_WORKING_DIRECTORY ?? process.cwd();
  const status = await readLocalGitStatus(workingDirectory);
  return NextResponse.json(status);
}
