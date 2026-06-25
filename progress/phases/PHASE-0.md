# تتبّع Phase 0 — التأسيس + نظام التصميم

**الحالة:** ✅ مكتمل · **التقدّم:** 100% · المرجع: [`Brain/phases/PHASE-0-foundation.md`](../../Brain/phases/PHASE-0-foundation.md)

> **القرار:** اعتماد **Laravel React Starter Kit** الرسمي (يوفّر React 19 + Inertia 2 + TS + Tailwind v4 + shadcn + Dark Mode + مصادقة جاهزة).

| # | المهمة | الحالة |
|---|--------|:------:|
| 1 | إنشاء مشروع Laravel + `.env` (MySQL `tawjeeh`) | ✅ |
| 2 | Inertia 2 + React 19 + Vite + TypeScript | ✅ |
| 3 | Tailwind CSS v4 | ✅ |
| 4 | هيكلة مجلدات Backend (Services/Repositories/Actions/DTOs/Support/Policies) | ✅ |
| 5 | المصادقة (تسجيل دخول جاهز من الـ kit) | ✅ |
| 6 | متغيّرات CSS (ألوان عنابية/خط Tajawal/زوايا 0.85rem) + RTL | ✅ |
| 7 | Dark Mode + مبدّل ثيم (من الـ kit + ألواننا) | ✅ |
| 8 | shadcn/ui + Lucide + Sonner + cva (+ TanStack/RHF/Zod/Recharts/Dropzone) | ✅ |
| 9 | مكوّنات الأساس (Button/Card/Badge/Input/Dialog/Table + **StatCard** + Sonner) | ✅ |
| 10 | Layout (Sidebar يمين RTL/Header/Breadcrumbs/BottomNav/Sheet) + شعار عربي | ✅ |
| 11 | PrintLayout أساسي + أنماط طباعة A4 عالمية | ✅ |
| 12 | النواة المشتركة (DataTable/FormDialog/FormSection/ConfirmDialog/PageHeader/Can) | ✅ |
| 13 | لوحة تجريبية تعرض النظام + بناء نظيف + تشغيل (200 OK) | ✅ |

## ما تم فعليًا
- **البيئة:** PHP 8.5، Composer 2.8، Node 22، MySQL 8.4 — قاعدة `tawjeeh` (utf8mb4) + migrations الأساسية + مستخدم تجريبي (`test@example.com` / `password`).
- **نظام التصميم في** [`resources/css/app.css`](../../resources/css/app.css): لوحة Apple العنابية (فاتح/داكن)، خط Tajawal، شريط جانبي داكن دائمًا، فئات `.tnum`/`.glass`/`.hover-lift`/`.shadow-luxe`، حركة `wiggle`، احترام `reduced-motion`، طباعة A4.
- **مكوّنات جديدة:** `ui/table`، `ui/sonner`، `stat-card`، `shared/{data-table, form-dialog, confirm-dialog, page-header, can}`، `layouts/print-layout`.
- **RTL:** `dir="rtl"` في `app.blade.php` + الشريط الجانبي `side="right"` + شعار/تنقّل عربي.
- **تحقّق:** `npm run build` ينجح (2011 وحدة) + `php artisan serve` يردّ 200 على `/login` مع Inertia وRTL.

## ملاحظات للمرحلة التالية
- `Can`/`usePermissions` جاهزة لكنها تعتمد على مشاركة `auth.permissions` التي تُفعّل في **Phase 1 (RBAC)**.
- نظام git: جذر المستودع عند `c:/laragon/www` (وليس مجلد المشروع) — لم يُجرَ commit (بانتظار طلب المستخدم).
