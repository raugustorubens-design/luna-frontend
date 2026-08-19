import assert from "node:assert/strict";
import test from "node:test";
import { hexHue, passesHueGate, findHueGateViolations } from "../hue-gate.mjs";

// Pacote "tirar o roxo do site" (GENESIS/pacotes/2026-08-19-tirar-o-roxo.md,
// Etapa 4) — um caso positivo e um negativo, incluindo o caso real que
// motivou a regra: nenhum portão existia quando #A78BFA entrou na coloração
// de sintaxe do Forge, vindo de um tema de editor emprestado.

test("passesHueGate — #A78BFA (o roxo real que motivou o portão) reprova", () => {
  assert.equal(passesHueGate("#A78BFA"), false);
});

test("passesHueGate — azul da faixa medida (200°-220°) aprova", () => {
  // #A0B8C8 (glow5, o acento do tema escuro) — dentro da faixa por cálculo,
  // não só por estar na lista de exceções.
  assert.ok(hexHue("#A0B8C8") >= 200 && hexHue("#A0B8C8") <= 220);
  assert.equal(passesHueGate("#A0B8C8"), true);
});

test("passesHueGate — dourado da faixa de emissão quente (17°-55°) aprova", () => {
  assert.ok(hexHue("#E4B448") >= 17 && hexHue("#E4B448") <= 55);
  assert.equal(passesHueGate("#E4B448"), true);
});

test("passesHueGate — verde e vermelho de classificação reprovariam por matiz, mas passam por exceção declarada", () => {
  const greenHue = hexHue("#2E7D32");
  assert.ok(greenHue > 55 && greenHue < 200, `verde não deveria cair dentro das faixas do portão por acaso (matiz: ${greenHue})`);
  assert.equal(passesHueGate("#2E7D32"), true);
  assert.equal(passesHueGate("#C62828"), true);
});

test("passesHueGate — Midnight (#1E2761, 232°) reprovaria pelo cálculo, mas é exceção declarada", () => {
  const hue = hexHue("#1E2761");
  assert.ok(hue > 220, `esperava matiz > 220 (fora da faixa azul), encontrado ${hue}`);
  assert.equal(passesHueGate("#1E2761"), true);
});

test("passesHueGate — cinza/preto/branco fora da lista de exceções reprova (matiz indefinido não escapa por acidente)", () => {
  assert.equal(passesHueGate("#808080"), false);
  assert.equal(passesHueGate("#000000"), false);
});

test("findHueGateViolations — encontra só o hex fora do portão numa string com vários", () => {
  const source = `
    const goodBlue = "#A0B8C8";
    const badPurple = "#A78BFA";
    const goodGold = "#E4B448";
  `;
  assert.deepEqual(findHueGateViolations(source), ["#A78BFA"]);
});

test("findHueGateViolations — string sem hex nenhum devolve lista vazia", () => {
  assert.deepEqual(findHueGateViolations('className="flex items-center gap-2"'), []);
});
