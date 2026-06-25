# تتبّع Phase 1 — الهيكل التنظيمي + RBAC

**الحالة:** ✅ مكتمل · **التقدّم:** 100% · المرجع: [`Brain/phases/PHASE-1-org-rbac.md`](../../Brain/phases/PHASE-1-org-rbac.md)

| # | المهمة | الحالة |
|---|--------|:------:|
| 1 | Migrations (stages/departments/classifications/roles/role_user/schools/users) | ✅ |
| 2 | Seeders (10 أقسام/3 مراحل/3 تصنيفات/4 أدوار/مستخدم رئيس توجيه) | ✅ |
| 3 | Trait HasRoles + Gate::before (super) + تسجيل الصلاحيات كـ Gates | ✅ |
| 4 | الحماية عبر Gates + can middleware (بدل Policy لكل موديل — قرار مبسّط) | ✅ |
| 5 | can middleware على المسارات + authorize في FormRequests | ✅ |
| 6 | مشاركة auth.user/permissions/is_super + usePermissions + Can + فلترة القائمة | ✅ |
| 7 | CRUD الأقسام (modal) | ✅ |
| 8 | CRUD المستخدمون (modal + إسناد أدوار/قسم) | ✅ |
| 9 | محرّر الأدوار/الصلاحيات (مصفوفة مجمّعة) | ✅ |
| 10 | CRUD المدارس (modal) | ✅ |
| 11 | إعداد المراحل + التصنيفات (صفحة إعدادات) | ✅ |
| 12 | Services (Department/School/User/Role) + FormRequests | ✅ |
| 13 | اختبارات الصلاحيات + Smoke (15 اختبار) | ✅ |

## ما تم فعليًا
- **قاعدة البيانات:** 6 migrations جديدة (stages, teacher_classifications, departments, roles+role_user, تعديل users, schools) + فهارس FK. Seeders كاملة.
- **RBAC:** `Support/Permissions.php` (سجل مركزي: 12 مجموعة صلاحيات + 4 أدوار + الافتراضات)، `Models/Concerns/HasRoles.php`، `Gate::before` للسوبر + تسجيل ديناميكي لكل المفاتيح كـ Gates في `AppServiceProvider`.
- **الواجهة:** 5 صفحات CRUD عبر Modals (`organization/{departments,schools,users,roles,settings}`) + شريط جانبي بصلاحيات + مشاركة الصلاحيات عبر Inertia.
- **اختبارات:** `RbacTest` (9) + `PagesSmokeTest` (6، تشمل دورة CRUD كاملة) — كلها تمر. إجمالي المشروع: **50 اختبار / 146 توكيد** يمر.
- **بناء:** `npm run build` نظيف.

## قرارات معمارية (تكييف عملي موثّق)
1. **Gates بدل Policy لكل موديل:** سجّلنا كل مفاتيح الصلاحيات كـ Gates مركزية + `Gate::before` للسوبر، بدل إنشاء Policy class لكل كيان. أبسط وأكثر DRY لنموذج صلاحيات مبني على مفاتيح. النطاقات (scoping) ستُضاف عبر Query Scopes في المراحل التشغيلية (3/5/6).
2. **Inertia `useForm` بدل RHF+Zod** لنماذج CRUD البسيطة: التحقق المعتمد في الـ Backend (FormRequest) والأخطاء تُعرض تلقائيًا. سنستخدم RHF+Zod للنماذج المعقّدة (استمارة الزيارة في Phase 5).
3. **Services تستخدم Eloquent مباشرة** للـ CRUD البسيط (بدل Repository منفصل). Repositories تُحجز للمنطق المعقّد (التوزيع/المؤشرات).

> ⚠️ **إصلاح مهم:** كان `HandleInertiaRequests::share()` يُحمّل علاقة `roles` بأعمدة ناقصة (دون `permissions`)، وبما أن `share()` يعمل **قبل** `can` middleware، كانت فحوص الصلاحيات تفشل. أُضيف عمود `permissions` للتحميل.

## بيانات الدخول (تطوير)
- **رئيس التوجيه:** `admin@tawjeeh.test` / `password`
