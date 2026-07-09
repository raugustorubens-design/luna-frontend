"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ModeSwitcher() {
  const pathname = usePathname();
  if (pathname?.startsWith("/forge")) return null;

  return (
    <Link
      href="/forge"
      className="fixed right-4 top-4 z-50 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-luna-textSub backdrop-blur-md hover:text-luna-cyanHi"
    >
      Dev Mode →
    </Link>
  );
}
