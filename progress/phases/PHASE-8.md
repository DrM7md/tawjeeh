# تتبّع Phase 8 — المتطلبات غير الوظيفية

**الحالة:** ✅ مكتمل (الأساسيات) · **التقدّم:** 100% · المرجع: [`Brain/phases/PHASE-8-non-functional.md`](../../Brain/phases/PHASE-8-non-functional.md)

| # | المهمة | الحالة |
|---|--------|:------:|
| 1 | audit_logs + Trait Auditable + شاشة السجل | ✅ |
| 2 | النسخ الاحتياطي (أمر + شاشة إدارة/تنزيل) | ✅ |
| 3 | حماية الملفات (تخزين خاص + تنزيل محمي) | ✅ (Phase 5) |
| 4 | تحديث آخر دخول + تسجيله | ✅ |
| 5 | الطباعة (PrintLayout أساسي + أنماط A4) | ✅ (أساسي) |
| 6 | فهارس + eager loading | ✅ |
| 7 | تدقيق RBAC + اختبارات | ✅ |
| 8 | تجاوب الجوّال (من الـ kit) + reduced-motion + ARIA | ✅ |
| 9 | بناء نظيف نهائي | ✅ |
| 10 | الإشعارات الفورية / push | ⏭️ مؤجَّل (مرحلة 2 المستقبلية) |

## ما تم فعليًا
- **سجل النشاط (X-1):** `audit_logs` + Trait `Auditable` (created/updated/deleted تلقائيًا، حجب `password`/`remember_token`) مُطبَّق على: User, Role, Department, School, AcademicYear, Visit, TestReview, SchoolAssignment. + تسجيل **الدخول** عبر مستمع `Login` (يحدّث `last_login_at` بهدوء). + شاشة `audit/index` مع فلترة وترقيم صفحات (صلاحية `audit.view`).
- **النسخ الاحتياطي:** أمر `tawjeeh:backup` (mysqldump → `storage/app/backups`) + `BackupController` + شاشة `backup/index` (إنشاء/تنزيل/حذف، صلاحية `backup.manage`).
- **حماية الملفات:** مرفقات الزيارات في disk `local` خاص + تنزيل عبر مسار محمي بصلاحية (Phase 5).
- **الأداء:** فهارس مركّبة على الجداول التشغيلية + eager loading في كل الخدمات.
- **الجودة:** نظام التصميم يحترم `prefers-reduced-motion` + ARIA (shadcn/Radix) + تجاوب (Sidebar/Sheet). `npm run build` نظيف.
- **اختبارات:** `AuditTest` (5): تسجيل CRUD، حجب كلمة المرور، تسجيل الدخول + آخر دخول، صلاحيات شاشتي السجل والنسخ. **إجمالي المشروع: 89 اختبار / 324 توكيد يمر.**

## مؤجَّل عمدًا (مطابق لـ «المرحلة الثانية» في المسودة الفنية §8)
- الإشعارات الفورية (push/realtime) + جرس الإشعارات الحيّ.
- تطبيق الجوّال، خرائط المدارس، ذكاء اصطناعي للتوصيات، توقيع إلكتروني متقدّم.
- تحسينات اختيارية: Jobs للعمليات الثقيلة (الاستيراد يعمل تزامنيًا حاليًا)، caching جدول `performance_indicators`، طباعة متقدّمة «صفحة X من Y».
