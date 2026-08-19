/**
 * Service worker da superfície /ronda (ADR-021 Fase 1). Escopo restrito a
 * /ronda no registro (ver components/ronda/register-service-worker.tsx) —
 * não interfere com o Forge nem o Modo Usuário.
 *
 * Responsabilidade única: manter a interface do wizard utilizável offline
 * (cache do app shell). A fila de dados (achados/fotos pendentes de envio)
 * é responsabilidade separada, em IndexedDB (lib/ronda/db.ts) — este
 * service worker nunca intercepta nem cacheia POST /convergia/ronda; a
 * requisição de envio sempre vai direto à rede (ou falha, e a fila em
 * IndexedDB é quem decide o reenvio, não o cache HTTP).
 *
 * Sem workbox/next-pwa (nenhuma dessas dependências existe neste projeto
 * hoje — introduzi-las seria uma decisão de tooling maior do que esta
 * etapa pede). Estratégia simples, escrita à mão:
 *   - navegação (HTML): network-first, cai para cache se offline.
 *   - outros assets (JS/CSS/ícones do Next.js): cache-first, atualiza o
 *     cache em segundo plano quando a rede responde.
 */

// v2 — Pacote "Safety Walk para o Padrão de Cores" (19/08/2026, ADR-024).
// Sem isto, quem já tem o PWA instalado não vê o CSS novo até o cache
// expirar sozinho: a estratégia de assets é cache-first. O bump força a
// troca; a limpeza de caches antigos no `activate` abaixo já existia antes
// desta etapa e continua intacta — não é IndexedDB (queue/originalPhotos
// vivem lá, nunca tocados por este arquivo) nem intercepta POST (linha 44).
const CACHE_NAME = "luna-ronda-shell-v2";
const PRECACHE_URLS = ["/ronda", "/ronda-manifest.json", "/ronda-icons/icon-192.png", "/ronda-icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept POST (ronda submission) — always straight to network.

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/ronda"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? networkFetch;
    }),
  );
});
