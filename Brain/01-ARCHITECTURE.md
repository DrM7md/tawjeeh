# 🏗️ الهيكلية التقنية (Architecture)

> راجع [`00-OVERVIEW.md`](00-OVERVIEW.md) للسياق العام.

---

## 1. حزمة التقنيات (Tech Stack)

### Backend
| المكوّن | الاختيار |
|--------|---------|
| الإطار | **Laravel** (أحدث إصدار مستقر) |
| قاعدة البيانات | **MySQL** (عبر Laragon) |
| المصادقة | Laravel Breeze/Fortify (Inertia stack) + RBAC مخصّص |
| الأنماط المعمارية | Service Layer + Repository Pattern + Actions + Policies + DTOs + Jobs + Events |

### Frontend
| المكوّن | الاختيار |
|--------|---------|
| المكتبة | **React 19** |
| الجسر | **Inertia.js** (SPA بدون API منفصل) |
| التنسيق | **Tailwind CSS v4** (عبر Vite، وليس Mix) |
| المكوّنات | **shadcn/ui** فوق **Radix UI** |
| الأيقونات | **Lucide React** |
| الجداول | **TanStack Table** |
| النماذج | **React Hook Form** |
| التحقق | **Zod** |
| التنبيهات | **Sonner** |
| الرسوم البيانية | **Recharts** |
| رفع الملفات | **React Dropzone** |
| متغيرات المكوّنات | **class-variance-authority (cva)** |
| الأداة | **Vite** |

---

## 2. هيكل مجلدات Backend

```
app/
├── Actions/              # عمليات أحادية الغرض (مثل DistributeSchoolsAction)
├── DTOs/                 # كائنات نقل البيانات
├── Events/               # الأحداث (VisitCompleted, AcademicYearChanged ...)
├── Http/
│   ├── Controllers/      # رفيعة — تفوّض للـ Services
│   ├── Middleware/        # CheckPermission, SetActiveContext (year/semester)
│   ├── Requests/          # FormRequest للتحقق
│   └── Resources/         # (اختياري) تحويل البيانات للواجهة
├── Jobs/                 # المهام المؤجلة (ImportSchoolData, GenerateReport)
├── Models/               # Eloquent Models
├── Policies/             # سياسات الصلاحيات لكل موديل
├── Repositories/         # طبقة الوصول للبيانات + Contracts
│   └── Contracts/
├── Services/             # منطق العمل الأساسي
└── Support/              # Helpers, Traits
```

### قاعدة التدفّق (Flow)
```
Route → Middleware → Controller → FormRequest (validation)
      → Service (business logic) → Repository (data access) → Model
      → Event/Job (آثار جانبية) → Inertia Response
```

**قواعد صارمة:**
- الـ Controller **لا يحتوي منطق عمل** — يفوّض للـ Service.
- الـ Service **لا يصل لقاعدة البيانات مباشرة** — يمرّ عبر Repository.
- التحقق دائمًا في **FormRequest** أو **Zod** (الواجهة) — مزدوج.
- الصلاحيات عبر **Policies** + Middleware (لا تحقق يدوي متناثر).

---

## 3. هيكل مجلدات Frontend

```
resources/js/
├── Pages/                # صفحات Inertia (مطابقة للمسارات)
│   ├── Auth/
│   ├── Dashboard/
│   ├── Organization/     # أقسام، مستخدمون، أدوار، مدارس
│   ├── Distribution/
│   ├── Import/
│   ├── Visits/
│   ├── TestReviews/
│   └── Reports/
├── Components/
│   ├── ui/               # مكوّنات shadcn الأساس (Button, Card, Dialog ...)
│   ├── shared/           # DataTable, ResourceModal, StatCard, Export ...
│   └── layout/           # Sidebar, Header, Breadcrumbs, BottomNav
├── Layouts/              # AppLayout, AuthLayout, PrintLayout
├── Hooks/                # useActiveContext, usePermissions, useConfirm
├── Services/             # غلاف لطلبات Inertia/axios المشتركة
├── lib/                  # utils (cn, formatters, zod schemas)
└── types/                # أنواع TypeScript المشتركة
```

> **ملاحظة:** يُفضّل استخدام **TypeScript** في الواجهة (مطلوب لـ Zod + shadcn).

---

## 4. الأنماط المشتركة (DRY Core)

لتفادي التكرار عبر 7 وحدات CRUD متشابهة، نبني **نواة موارد مشتركة**:

| المكوّن | الغرض |
|--------|-------|
| `DataTable` | جدول TanStack موحّد: بحث لحظي، فلاتر، فرز، صفحات، تصدير |
| `ResourceModal` / `FormDialog` | نافذة موحّدة للإضافة/التعديل (لا صفحات منفصلة) |
| `FormSection` / `FormActions` | أجزاء نموذج قابلة لإعادة الاستخدام |
| `ConfirmDialog` | تأكيد الحذف/الإجراءات الخطرة |
| `StatCard` | بطاقة إحصائية زجاجية (الميزة المميّزة) |
| `PageHeader` | ترويسة صفحة + breadcrumbs + أزرار إجراء |
| `ExportButton` | تصدير Excel/PDF موحّد |

في الـ Backend:
| المكوّن | الغرض |
|--------|-------|
| `BaseRepository` | عمليات CRUD عامة + scoping تلقائي للعام/الفصل |
| `BaseService` | غلاف للعمليات الشائعة |
| `BelongsToAcademicContext` (Trait + Global Scope) | ربط تلقائي للسجلات بالعام/الفصل الفعّال |
| `HasRoles` / `HasPermissions` (Trait) | منطق الصلاحيات |
| `Auditable` (Trait) | تسجيل تلقائي في `audit_logs` |

---

## 5. سياق العام/الفصل الفعّال (Active Context)

> هذا أهم نمط معماري في النظام. تفاصيل القواعد في [`05-BUSINESS-RULES.md`](05-BUSINESS-RULES.md).

- **Middleware `SetActiveContext`**: يحدّد العام والفصل الفعّال لكل طلب (من جلسة المستخدم أو الافتراضي) ويشاركه مع Inertia عبر `HandleInertiaRequests::share()`.
- **Global Scope `AcademicContextScope`**: يضيف تلقائيًا `WHERE academic_year_id = ?` (و`semester_id` حيثما وُجد) على الموديلات الموسومة بـ Trait.
- **عند الإنشاء**: يُملأ `academic_year_id` / `semester_id` تلقائيًا من السياق الفعّال (عبر `creating` event في الـ Trait).
- **في الواجهة**: محدّد علوي (Year/Semester Switcher) في الترويسة؛ عند التبديل تُعاد كل الصفحات والعدادات تلقائيًا (Inertia reload).

---

## 6. المتطلبات غير الوظيفية (مرجع سريع)

| المتطلب | التنفيذ |
|--------|---------|
| RBAC دقيق | Policies + permissions JSON + Middleware |
| سجل نشاط كامل | Trait `Auditable` → جدول `audit_logs` |
| نسخ احتياطي | `spatie/laravel-backup` أو أمر Artisan مجدول |
| سرعة عالية | Eager loading، فهارس DB، caching للمؤشرات، Jobs للعمليات الثقيلة |
| دعم الجوال | تصميم متجاوب + Bottom Nav + Sheet |
| حماية الملفات | تخزين خاص (`storage/app/private`) + توصيل عبر مسار محمي بصلاحية |
| أرشفة إلكترونية | حالة الأرشيف للأعوام/الفصول بدل الحذف |
| قابلية التوسع | Repository/Service تفصل الطبقات، Jobs/Events |

تفاصيل التنفيذ في [`phases/PHASE-8-non-functional.md`](phases/PHASE-8-non-functional.md).
