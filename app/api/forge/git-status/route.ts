import { NextResponse } from "next/server";
import { readLocalGitStatus } from "@/lib/forge/git";

export async function GET() {
  const status = await readLocalGitStatus(process.cwd());
  return NextResponse.json(status);
}
