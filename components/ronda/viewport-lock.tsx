"use client";

import { useEffect } from "react";

/**
 * Marca `<html>` enquanto a pessoa está em `/ronda`, pra `globals.css`
 * poder aplicar as regras da superfície de campo (rolagem travada na
 * viewport, fonte mínima de 16px nos campos) sem vazar pro Forge nem pro
 * Modo Usuário, que dividem o mesmo `<body>` do layout raiz.
 *
 * Uma classe num efeito, e não `body:has(.ronda-shell)`: `:has()` só existe
 * a partir do Safari 15.4, e o parque de celulares que roda o Safety Walk
 * em campo não é escolhido por nós. A classe funciona em qualquer
 * navegador que rode React.
 */
export function ViewportLock() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("ronda-locked");
    return () => root.classList.remove("ronda-locked");
  }, []);

  return null;
}
