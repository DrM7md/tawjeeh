/**
 * تسجيل Service Worker لتفعيل خصائص PWA (التثبيت + العمل دون اتصال).
 * يُسجَّل في الإنتاج فقط كي لا يتعارض مع الـ HMR أثناء التطوير.
 */
export function registerServiceWorker() {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (!import.meta.env.PROD) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
            // فشل التسجيل لا يؤثر على عمل التطبيق
        });
    });
}
