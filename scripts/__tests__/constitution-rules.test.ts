import assert from "node:assert/strict";
import test from "node:test";
import { containsDatabaseModuleImport } from "../constitution-rules.mjs";

// Revisão do Engenheiro, luna-frontend#28 apontamento 1 (17/08/2026) — um
// caso positivo e um negativo por família, incluindo os quatro buracos que
// a revisão achou testando a regex anterior à mão.

test("containsDatabaseModuleImport — @supabase/* (qualquer pacote da organização)", () => {
  assert.equal(containsDatabaseModuleImport('import { createClient } from "@supabase/supabase-js";'), true);
  // O buraco que a revisão achou: nome exato só pegava "supabase-js", não a família.
  assert.equal(containsDatabaseModuleImport('import { createServerClient } from "@supabase/ssr";'), true);
  assert.equal(containsDatabaseModuleImport('import { useSession } from "@supabase/auth-helpers-react";'), true);
  assert.equal(containsDatabaseModuleImport('import { Folder } from "lucide-react";'), false);
});

test("containsDatabaseModuleImport — drizzle-orm, raiz e qualquer subcaminho", () => {
  assert.equal(containsDatabaseModuleImport('import { drizzle } from "drizzle-orm";'), true);
  // O buraco: drizzle-orm/pg-core é o import normal do Drizzle, e o nome exato não pegava.
  assert.equal(containsDatabaseModuleImport('import { pgTable } from "drizzle-orm/pg-core";'), true);
  assert.equal(containsDatabaseModuleImport('import { z } from "zod";'), false);
});

test("containsDatabaseModuleImport — clientes de Postgres (pg, postgres, pg-promise), nome exato", () => {
  assert.equal(containsDatabaseModuleImport('const { Client } = require("pg");'), true);
  assert.equal(containsDatabaseModuleImport('import postgres from "postgres";'), true);
  assert.equal(containsDatabaseModuleImport('import pgPromise from "pg-promise";'), true);
  // "pg-mem" não é um dos três nomes da família — não deve casar por prefixo solto.
  assert.equal(containsDatabaseModuleImport('import { newDb } from "pg-mem";'), false);
});

test("containsDatabaseModuleImport — cobre as cinco formas de referenciar um módulo", () => {
  assert.equal(containsDatabaseModuleImport('import x from "@supabase/supabase-js";'), true, "import ... from");
  assert.equal(containsDatabaseModuleImport('export { x } from "@supabase/supabase-js";'), true, "export ... from");
  // O buraco: import de efeito colateral, sem "from" nenhum.
  assert.equal(containsDatabaseModuleImport('import "pg";'), true, "import de efeito colateral");
  assert.equal(containsDatabaseModuleImport('const pg = require("pg");'), true, "require()");
  assert.equal(containsDatabaseModuleImport('await import("pg");'), true, "import() dinâmico");
});

test("containsDatabaseModuleImport — nunca casa prosa mencionando o nome, só código real (regressão do fix anterior)", () => {
  assert.equal(
    containsDatabaseModuleImport('line: "Grava no Supabase com vetor semântico. Único ponto do sistema que escreve no banco."'),
    false,
  );
  assert.equal(containsDatabaseModuleImport('{ term: "Falta", value: "Leitura de Supabase e Railway" }'), false);
});
