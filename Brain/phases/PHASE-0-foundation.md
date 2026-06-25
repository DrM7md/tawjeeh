# Phase 0 — التأسيس + نظام التصميم

**الهدف:** مشروع جاهل يعمل (Laravel + React/Inertia + Tailwind v4 + shadcn) مع نظام التصميم ومكوّنات الأساس والـ Layout، قبل أي منطق عمل.

**يعتمد على:** لا شيء. **يمكّن:** كل المراحل اللاحقة.

---

## المهام

### Backend / إعداد المشروع
- [ ] إنشاء مشروع Laravel جديد + ضبط `.env` (MySQL via Laragon، اسم DB: `tawjeeh`).
- [ ] تثبيت Inertia + React 19 + Vite + TypeScript.
- [ ] تثبيت Tailwind CSS v4 عبر Vite.
- [ ] هيكلة مجلدات Backend (Services/Repositories/Actions/DTOs/Policies) كما في [`01-ARCHITECTURE.md`](../01-ARCHITECTURE.md).
- [ ] إعداد المصادقة (Breeze/Fortify - Inertia React) — تسجيل دخول فقط (لا تسجيل عام).

### نظام التصميم
- [ ] متغيّرات CSS (ألوان HSL، خطوط Tajawal، `--radius`) في `resources/css/app.css`.
- [ ] إعداد RTL عام + الخطوط + `tabular-nums`.
- [ ] Dark Mode عبر `.dark` + مبدّل ثيم.
- [ ] تثبيت shadcn/ui + Radix + Lucide + Sonner + cva.

### مكوّنات الأساس (ui/)
- [ ] Button, Card, **StatCard** (الزجاجية), Table, Dialog, Badge, Input, Select, Label, Sheet.

### Layout
- [ ] `AppLayout`: شريط جانبي يمين قابل للطي (SidebarProvider) + ترويسة `h-16` + breadcrumbs `h-12`.
- [ ] Bottom Nav للجوّال + Sheet للقائمة.
- [ ] مكان محدّد العام/الفصل في الترويسة (placeholder حتى Phase 2).
- [ ] `PrintLayout` أساسي (A4 RTL).

### النواة المشتركة (shared/)
- [ ] `DataTable` (TanStack: بحث/فلترة/فرز/صفحات).
- [ ] `FormDialog` + `FormSection` + `FormActions`.
- [ ] `ConfirmDialog`, `PageHeader`, `ExportButton`, `<Can>`.

### الجودة
- [ ] صفحة لوحة تحكم تجريبية تعرض StatCards + جدول وهمي للتأكد من النظام.

---

## معايير القبول (DoD)
- المشروع يعمل: `npm run dev` + `php artisan serve` بلا أخطاء.
- تسجيل الدخول يعمل.
- لوحة تجريبية تعرض نظام التصميم (فاتح/داكن) بشكل صحيح RTL.
- مكوّنات الأساس والنواة المشتركة موجودة وموثّقة.
- `npm run build` ينجح.
