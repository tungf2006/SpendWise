// Service Worker cho SpendWise PWA (Network-First cho HTML/Navigation, bỏ qua API và cross-origin)
// Phụ trách: TV2 (Hồ Nguyên Văn)

const CACHE_NAME = 'spendwise-v3'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key)
            }
            return null
          })
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // Bỏ qua các API backend, Supabase, Gemini và mọi request cross-origin (VietQR, Google Fonts, ...)
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.origin !== self.location.origin
  ) {
    return
  }

  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && url.origin === self.location.origin) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          }
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((res) => res || caches.match('/index.html'))
            .then((res) => res || Response.error())
        )
    )
    return
  }

  // Tài nguyên tĩnh: Stale-While-Revalidate an toàn cho cùng origin
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && url.origin === self.location.origin) {
            const copy = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return networkResponse
        })
        .catch(() => cachedResponse || Response.error())

      return cachedResponse || fetchPromise
    })
  )
})
