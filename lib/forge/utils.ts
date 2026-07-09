import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Copiado de forge/apps/web/src/lib/utils.ts (monorepo `luna`), origem em apps/frontend/artifacts/frontend/src/lib/utils.ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
