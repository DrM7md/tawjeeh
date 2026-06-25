# تتبّع Phase 2 — الأعوام والفصول + السياق

**الحالة:** ✅ مكتمل · **التقدّم:** 100% · المرجع: [`Brain/phases/PHASE-2-academic-year-semester.md`](../../Brain/phases/PHASE-2-academic-year-semester.md)

| # | المهمة | الحالة |
|---|--------|:------:|
| 1 | Migrations (academic_years/semesters) + Seeder (عام نشط + فصلان) | ✅ |
| 2 | Trait BelongsToAcademicContext + Global Scope (فلترة + تعبئة تلقائية) | ✅ |
| 3 | ActiveContext (singleton) + مشاركة عبر Inertia | ✅ |
| 4 | AcademicYearService (تفعيل واحد/إغلاق/أرشفة/توليد فصول) | ✅ |
| 5 | SemesterService (فصل نشط واحد/إغلاق) | ✅ |
| 6 | شاشة إدارة الأعوام (بطاقات + إجراءات) | ✅ |
| 7 | إدارة الفصول (مدمجة ضمن بطاقة العام) | ✅ |
| 8 | محدّد العام/الفصل في الترويسة (ContextSwitcher) | ✅ |
| 9 | وضع القراءة فقط عند الإغلاق (context.isEditable) | ✅ |
| 10 | اختبارات القواعد (AY/SM) + السياق + الـ Scope | ✅ |

## ما تم فعليًا
- **قاعدة البيانات:** `academic_years` + `semesters` + Seeder للعام «2026–2027» (نشط) بفصلين (الأول نشط).
- **نواة السياق:** `Support/ActiveContext.php` (singleton): يميّز بين **النشط** (وجهة الإنشاء) و**المختار** (وجهة العرض، يُخزّن بالجلسة). + `Models/Scopes/AcademicContextScope.php` + `Models/Concerns/BelongsToAcademicContext.php` (فلترة تلقائية + تعبئة `academic_year_id`/`semester_id` عند الإنشاء، مع `usesSemester=false` للموديلات بلا فصل، و`withoutAcademicContext()`).
- **الخدمات:** AcademicYearService (تفعيل ذرّي AY-1، إغلاق، أرشفة AY-3، توليد فصلين) + SemesterService (تفعيل ذرّي SM-2، إغلاق SM-5).
- **الواجهة:** صفحة `academic/index` (بطاقات الأعوام + فصولها + كل الإجراءات) + `ContextSwitcher` في الترويسة (تبديل يعيد تحميل بيانات الصفحة) + مشاركة `context` عبر Inertia.
- **اختبارات:** `AcademicContextTest` (8) + `ContextScopeTest` (2، تتحقق من التعبئة التلقائية والفلترة عبر جدول/موديل تجريبي). **إجمالي المشروع: 51 اختبار / 177 توكيد يمر.**

## قواعد العمل المطبّقة
AY-1 (عام نشط واحد)، AY-3 (أرشفة بلا حذف)، SM-2 (فصل نشط واحد)، SM-5 (إغلاق للعرض)، AY-2/SM-3 (تعبئة تلقائية)، AY-5 (المؤشرات/العرض حسب المختار). AY-4 (نسخ التوزيع) مؤجَّل لـ Phase 3 (يعتمد على school_assignments).

## جاهز للاستخدام في المراحل التالية
- أي موديل تشغيلي (Phase 3/5/6) يضيف `use BelongsToAcademicContext;` + أعمدة `academic_year_id` (و`semester_id`) ليُفلتر ويُعبّأ تلقائيًا.
