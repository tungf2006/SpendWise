// Service Worker cơ bản cho SpendWise PWA (Chỉ cache shell tĩnh cơ bản)
// Phụ trách: TV2 (Hồ Nguyên Văn)

const CACHE_NAME = 'spendwise-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Bỏ qua các request gửi tới Supabase API hoặc Gemini API
  if (event.request.url.includes('supabase.co') || event.request.url.includes('generativelanguage.googleapis.com')) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request)
    })
  )
})
