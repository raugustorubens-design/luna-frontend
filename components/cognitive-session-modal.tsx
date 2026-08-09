"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, GitBranch, Footprints } from "lucide-react";

interface CognitiveSessionModalProps {
  open: boolean;
  onClose: () => void;
}

export function CognitiveSessionModal({ open, onClose }: CognitiveSessionModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cognitive-session-title"
            className="glass w-full max-w-md rounded-2xl p-6 shadow-aura"
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start justify-between">
              <h2 id="cognitive-session-title" className="text-lg font-semibold">
                Iniciar Sessão Cognitiva
              </h2>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-lg p-1 text-luna-textMuted transition hover:bg-white/10 hover:text-luna-text"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-2 text-sm text-luna-textSub">Escolha como você quer entrar na LUNA agora.</p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => router.push("/forge?tab=convergia")}
                className="flex items-center gap-3 rounded-xl bg-luna-violet px-4 py-3 text-left text-sm font-medium shadow-aura transition hover:-translate-y-0.5"
              >
                <GitBranch size={18} />
                <span>
                  <span className="block font-semibold">Luna Convergia</span>
                  <span className="block text-xs font-normal text-white/70">Abrir aba Convergia no Forge</span>
                </span>
              </button>
              <button
                onClick={() => router.push("/ronda")}
                className="flex items-center gap-3 rounded-xl bg-luna-violet px-4 py-3 text-left text-sm font-medium shadow-aura transition hover:-translate-y-0.5"
              >
                <Footprints size={18} />
                <span>
                  <span className="block font-semibold">LUNA Safety Walk</span>
                  <span className="block text-xs font-normal text-white/70">Registrar ronda de segurança (SSMA)</span>
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
