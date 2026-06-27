/* eslint-env serviceworker */
/* Service Worker — نظام توجيه (PWA)
 * استراتيجية آمنة للتطبيقات المُصادَق عليها:
 *  - التنقّلات (صفحات HTML/Inertia): الشبكة أولاً، وعند انقطاع الاتصال تُعرض صفحة offline.
 *    لا نُخزّن صفحات HTML المُصادَق عليها كي لا تتسرّب بيانات بين المستخدمين على نفس الجهاز.
 *  - أصول البناء (/build/*) ثابتة ومُبصمة: الكاش أولاً.
 *  - الصور/الخطوط/الأيقونات: عرض من الكاش مع تحديث في الخلفية (stale-while-revalidate).
 */
const VERSION = 'v1';
const STATIC_CACHE = `tawjeeh-static-${VERSION}`;
const ASSET_CACHE = `tawjeeh-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
    OFFLINE_URL,
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/maskable-512.png',
    '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys.filter((k) => k !== STATIC_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)),
            );
            await self.clients.claim();
        })(),
    );
});

// السماح للصفحة بطلب التفعيل الفوري للنسخة الجديدة
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isBuildAsset(url) {
    return url.origin === self.location.origin && url.pathname.startsWith('/build/');
}

function isCacheableAsset(request, url) {
    if (url.origin === self.location.origin && url.pathname.startsWith('/icons/')) return true;
    const dest = request.destination;
    return dest === 'image' || dest === 'font' || dest === 'style';
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // التنقّلات: الشبكة أولاً ثم صفحة offline
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(async () => {
                const cache = await caches.open(STATIC_CACHE);
                return (await cache.match(OFFLINE_URL)) ?? Response.error();
            }),
        );
        return;
    }

    // أصول البناء المُبصمة: الكاش أولاً
    if (isBuildAsset(url)) {
        event.respondWith(
            caches.open(ASSET_CACHE).then(async (cache) => {
                const cached = await cache.match(request);
                if (cached) return cached;
                const response = await fetch(request);
                if (response.ok) cache.put(request, response.clone());
                return response;
            }),
        );
        return;
    }

    // صور/خطوط/أيقونات: عرض من الكاش مع تحديث في الخلفية
    if (isCacheableAsset(request, url)) {
        event.respondWith(
            caches.open(ASSET_CACHE).then(async (cache) => {
                const cached = await cache.match(request);
                const network = fetch(request)
                    .then((response) => {
                        if (response.ok) cache.put(request, response.clone());
                        return response;
                    })
                    .catch(() => cached);
                return cached ?? network;
            }),
        );
    }
});
