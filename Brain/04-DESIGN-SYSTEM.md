# 🎨 نظام التصميم (Apple-Inspired RTL Design System)

> مصدر هذا النظام: `UI/UI.txt`. التزم به على **كل صفحة ومكوّن**.

---

## 1. التقنيات
- React 19 + Inertia.js فوق Laravel.
- **Tailwind CSS v4** عبر Vite (وليس Mix).
- مكوّنات **shadcn/ui** المبنية على **Radix UI**.
- أيقونات **Lucide React** فقط.
- إشعارات **Sonner** (نمط Apple).
- **class-variance-authority (cva)** لإدارة متغيّرات المكوّنات.

---

## 2. لوحة الألوان (CSS variables بصيغة HSL)

### الوضع الفاتح (افتراضي)
| المتغيّر | القيمة | الوصف |
|---------|-------|------|
| Primary | `hsl(342, 68%, 33%)` | عنابي آبل `#8D1B3D` |
| Background | `hsl(240 11% 96%)` | رمادي فاتح `#F5F5F7` |
| Foreground | `hsl(240 6% 10%)` | أسود مائل `#1D1D1F` |
| Card | `#FFFFFF` | |
| Muted | `#F0F0F2` | |
| Border | `#E5E5E7` | |
| Success | `#34C759` | |
| Warning | `#FF9F0A` | |
| Destructive | `#FF3B30` | |
| Sidebar | خلفية `#1D1D1F` نص `#D1D1D3` | **داكن دائمًا** في الوضعين |

### الوضع الداكن (`.dark` على الجذر)
- نفس المتغيّرات معكوسة، مع إبقاء الشريط الجانبي داكنًا.

---

## 3. الخطوط (Typography)
- الأساسي: **Tajawal** ← `Plus Jakarta Sans` ← `system-ui`.
- التطبيق بأكمله **RTL**: `direction: rtl; text-align: right`.
- أرقام لاتينية مع `font-variant-numeric: tabular-nums` للأعمدة الرقمية (كلاس `.tnum`).
- المقاسات:
  - عنوان الصفحة: `text-2xl font-bold tracking-tight`
  - عنوان قسم: `text-xl font-semibold`
  - النص: `text-sm`
  - التلميحات: `text-xs`

---

## 4. التخطيط (Layout)
- **شريط جانبي على اليمين** (RTL)، قابل للطيّ لأيقونات (`16rem` مفتوح / `3rem` مطوي) عبر `SidebarProvider`.
- ترويسة علوية `h-16` (64px) + شريط breadcrumbs `h-12`.
- لوحة تحكّم = **بطاقات إحصائية ضمن grid**.
- **Bottom Nav** للجوّال فقط (breakpoint عند `md`).
- قوائم منبثقة (**Sheet**) للقائمة على الجوّال.
- **محدّد العام/الفصل** في الترويسة (Active Context Switcher).

---

## 5. مواصفات المكوّنات

### الزوايا (radius)
- المتغيّر الأساس: `--radius: 0.85rem`.
- البطاقات: `rounded-2xl` (16px).
- النوافذ (modals): `rounded-[28px]`.
- الشارات والأزرار الحبّية: `rounded-full`.

### الأزرار
- variants: default / outline / ghost / destructive / secondary / link.
- ظل خفيف، `transition-colors 0.2s`، تركيز `focus-visible:ring-2`.

### البطاقات الإحصائية (StatCard — الميزة المميّزة)
- glassmorphism: `backdrop-filter: blur(20px) saturate(180%)` + خلفية شبه شفافة.
- شريط تدرّج لوني علوي 0.5px حسب اللون (tone).
- أيقونة داخل مربّع `size-11 rounded-xl` بخلفية ملوّنة خفيفة.
- رفع عند المرور: `translateY(-2px)` + زيادة الظل.

### الجداول
- ترويسة: `text-xs font-semibold text-muted-foreground`.
- صفوف بحدّ سفلي + `hover:bg-muted/50`، حشوة خلايا `p-4`.

### النماذج
- حقول `h-10`، حشوة `px-3 py-2`، حلقة تركيز.

### النوافذ (Dialogs)
- خلفية `bg-card/95` + `backdrop-blur-2xl`.
- تعتيم `bg-black/30 backdrop-blur-md`.
- ظل فاخر: `0 30px 60px -15px rgba(0,0,0,0.25)`.
- زرّ إغلاق دائري في الزاوية.

### الإشعارات (Sonner)
- أعلى الوسط، عرض 380px، `rounded-[18px]` زجاجي.
- شريط لوني جانبي 3px، أيقونة داخل دائرة 34px، RTL.

---

## 6. الحركات (Animations)
- مدّة عامّة 0.15s–0.2s ease.
- Spring المرح: `cubic-bezier(0.34, 1.56, 0.64, 1)` للتأكيدات.
- اختياري: **confetti** (~160 جسيم) عند الإنجازات، اهتزاز جرس (wiggle) عند غير مقروء، نبضة pulse.
- احترِم دائمًا `prefers-reduced-motion`.

---

## 7. الطباعة (Print)
- A4 بهوامش 2cm، إخفاء الشريط الجانبي والترويسة.
- ترويسة/تذييل متكرّران، تذييل عربي «صفحة X من Y».
- إزالة الظلال والـ blur لتوفير الحبر، `print-color-adjust: exact`.

---

## 8. الطابع العام (Vibe)
عصري + احترافي + مرح + premium: خطوط نظيفة، زجاجية، ظلال راقية، ألوان حيّة، عناصر تحفيزية (شارات/لوحات شرف/نجوم)، دعم كامل لإمكانية الوصول (ARIA/تركيز) وللـ RTL.

---

## 9. ترتيب البناء (إلزامي)
1. إعداد متغيّرات CSS (ألوان/خطوط/زوايا) في ملف CSS الرئيسي.
2. مكوّنات الأساس: `Button, Card, StatCard, Table, Dialog, Badge, Input`.
3. مكوّنات Layout: `Sidebar, Header, Breadcrumbs, BottomNav`.
4. النواة المشتركة: `DataTable, FormDialog, ConfirmDialog, PageHeader, ExportButton`.
5. ثم الصفحات.
