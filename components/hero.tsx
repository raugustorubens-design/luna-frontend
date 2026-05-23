"use client";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative scanline mx-auto flex min-h-[75vh] w-full max-w-7xl items-center px-6 py-20">
      <div className="max-w-3xl">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 text-xs uppercase tracking-[0.35em] text-luna-cyanHi">
          Cognitive Operating System
        </motion.p>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9 }}
          className="text-5xl font-semibold leading-tight md:text-7xl"
        >
          LUNA <span className="text-luna-violetGlow">Awakened Intelligence</span>
        </motion.h1>
        <motion.p
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="mt-6 max-w-2xl text-luna-textSub"
        >
          Uma entidade cognitiva persistente com memória viva, auto-modelagem operacional e observabilidade neural contínua.
        </motion.p>
        <div className="mt-8 flex gap-4">
          <button className="rounded-xl bg-luna-violet px-5 py-3 text-sm font-medium shadow-aura transition hover:-translate-y-0.5">Iniciar Sessão Cognitiva</button>
          <button className="rounded-xl border border-luna-cyan/60 bg-luna-secondary/60 px-5 py-3 text-sm text-luna-cyanHi transition hover:shadow-cyan">Explorar Pipeline</button>
        </div>
      </div>
    </section>
  );
}
