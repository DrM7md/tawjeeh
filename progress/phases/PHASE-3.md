# تتبّع Phase 3 — توزيع المدارس

**الحالة:** ✅ مكتمل · **التقدّم:** 100% · المرجع: [`Brain/phases/PHASE-3-school-distribution.md`](../../Brain/phases/PHASE-3-school-distribution.md)

| # | المهمة | الحالة |
|---|--------|:------:|
| 1 | Migration school_assignments + UNIQUE (+ coordinators/teachers مُقدَّمة من Phase 4) | ✅ |
| 2 | DistributeSchoolsAction (least-loaded + أوزان) | ✅ |
| 3 | DistributionService (تلقائي/يدوي/إعادة/مسح + معاينة) | ✅ |
| 4 | حساب مؤشرات الحمل + نسبة العدالة (معامل الاختلاف) | ✅ |
| 5 | شاشة التوزيع + StatCards | ✅ |
| 6 | سحب وإفلات (Native DnD) لنقل المدارس بين الموجهين | ✅ |
| 7 | توزيع تلقائي مع معاينة قبل التأكيد | ✅ |
| 8 | نطاق القسم (رئيس قسم يوزّع قسمه فقط) | ✅ |
| 9 | اختبارات (8) | ✅ |

## ما تم فعليًا
- **جداول:** `school_assignments` (UNIQUE سنة+مدرسة+قسم — DS-5) + **`teachers`/`coordinators`** (قُدِّمتا من Phase 4 لأن وزن المدرسة يعتمد عليهما) — كلها تستخدم `BelongsToAcademicContext` (مرتبطة بالعام، `usesSemester=false`).
- **الخوارزمية:** `Actions/DistributeSchoolsAction` (least-loaded first، وزن المدرسة = base + معلمون + منسقون×0.5 + زيارات مطلوبة×0.3).
- **الخدمة:** `DistributionService` — overview (أحمال + عدالة)، autoDistributePreview (معاينة للمتبقّي/الكل)، assign/unassign/clear/saveAssignments، نطاق الأقسام حسب المستخدم.
- **الواجهة:** `distribution/index` — لوحة أعمدة (غير موزّعة + عمود لكل موجه) بسحب وإفلات أصلي، StatCards (مدارس/مسندة/موجهون/عدالة%)، أزرار توزيع تلقائي + معاينة قبل التطبيق، مسح التوزيع.
- **اختبارات:** `DistributionTest` (8): توازن الخوارزمية، UNIQUE، المعاينة، العدّ، النطاق، الصلاحيات. **إجمالي المشروع: 59 اختبار / 198 توكيد يمر.**

## قواعد العمل المطبّقة
DS-1 (عدالة)، DS-2 (عوامل الوزن)، DS-3 (تلقائي/يدوي/إعادة)، DS-4 (نطاق القسم)، DS-5 (UNIQUE).

## ملاحظات
- AY-4 (نسخ توزيع عام سابق) — يمكن إضافته الآن لاحقًا كزرّ في صفحة الأعوام (مؤجَّل، غير حرج).
- وزن المدرسة = 0 معلمين قبل الاستيراد (Phase 4)؛ التوزيع يعمل بالعدد ويصبح أدقّ بعد الاستيراد.
