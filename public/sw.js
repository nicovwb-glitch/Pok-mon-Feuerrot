const VERSION = 'feuerrot-offline-v1'
const BASIS = '/Pok-mon-Feuerrot/'
const APP_CACHE = `${VERSION}-app`
const DATEN_CACHE = `${VERSION}-daten`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll([
    BASIS,
    `${BASIS}index.html`,
    `${BASIS}manifest.webmanifest`,
    `${BASIS}pokeball-app-icon.svg`,
  ])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((namen) => Promise.all(
    namen.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)),
  )).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((antwort) => {
      const kopie = antwort.clone()
      void caches.open(APP_CACHE).then((cache) => cache.put(event.request, kopie))
      return antwort
    }).catch(async () => (await caches.match(event.request)) || (await caches.match(BASIS))))
    return
  }

  const appDatei = url.origin === self.location.origin
  const externeDaten = url.hostname === 'pokeapi.co'
    || url.hostname === 'raw.githubusercontent.com'
    || url.hostname === 'fonts.googleapis.com'
    || url.hostname === 'fonts.gstatic.com'
  if (!appDatei && !externeDaten) return

  event.respondWith(caches.match(event.request).then((gespeichert) => {
    if (gespeichert) return gespeichert
    return fetch(event.request).then((antwort) => {
      if (antwort.ok || antwort.type === 'opaque') {
        const cacheName = appDatei ? APP_CACHE : DATEN_CACHE
        void caches.open(cacheName).then((cache) => cache.put(event.request, antwort.clone()))
      }
      return antwort
    })
  }))
})
