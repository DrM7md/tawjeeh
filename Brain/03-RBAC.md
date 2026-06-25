# 🔐 الأدوار والصلاحيات (RBAC)

> راجع جداول `users`, `roles`, `role_user` في [`02-DATABASE.md`](02-DATABASE.md).

---

## 1. الأدوار النظامية (System Roles)

| المعرّف | الاسم المعروض | المستوى | النطاق |
|--------|--------------|:------:|--------|
| `head_of_guidance` | رئيس التوجيه | 1 | كل النظام |
| `assistant_head` | مساعد رئيس التوجيه | 1 | كل النظام (قد يُقيَّد) |
| `department_head` | رئيس القسم | 2 | قسمه فقط |
| `supervisor` | موجه | 3 | مدارسه المكلّف بها فقط |

- أدوار النظام `is_system = true` (لا تُحذف، يمكن تعديل صلاحياتها بحذر).
- يمكن لرئيس التوجيه إنشاء أدوار مخصّصة إضافية.

---

## 2. مفاتيح الصلاحيات (Permission Keys)

تُخزَّن في `roles.permissions` كمصفوفة JSON. التسمية: `module.action`.

| الوحدة | المفاتيح |
|-------|---------|
| المستخدمون | `users.view`, `users.create`, `users.update`, `users.delete` |
| الأدوار | `roles.view`, `roles.manage` |
| الأقسام | `departments.view`, `departments.manage` |
| المدارس | `schools.view`, `schools.manage` |
| الأعوام/الفصول | `academic.view`, `academic.manage` |
| التوزيع | `distribution.view`, `distribution.auto`, `distribution.manual`, `distribution.redistribute` |
| الاستيراد | `import.view`, `import.run` |
| الزيارات | `visits.view.own`, `visits.view.department`, `visits.view.all`, `visits.create`, `visits.update`, `visits.finalize` |
| الاستمارات | `forms.fill`, `forms.finalize`, `forms.review` |
| التحكيم | `reviews.view.own`, `reviews.view.department`, `reviews.view.all`, `reviews.create`, `reviews.finalize` |
| المؤشرات/التقارير | `reports.department`, `reports.global`, `reports.export` |
| النظام | `audit.view`, `backup.manage`, `settings.manage` |

---

## 3. مصفوفة الصلاحيات الافتراضية

| المفتاح | رئيس التوجيه | مساعد | رئيس قسم | موجه |
|--------|:---:|:---:|:---:|:---:|
| users.* | ✅ | ✅ | ❌ | ❌ |
| roles.manage | ✅ | ❌ | ❌ | ❌ |
| departments.manage | ✅ | ✅ | ❌ | ❌ |
| schools.manage | ✅ | ✅ | ✅ (قسمه) | ❌ |
| academic.manage | ✅ | ✅ | ❌ | ❌ |
| distribution.* | ✅ | ✅ | ✅ (قسمه) | ❌ |
| import.run | ✅ | ✅ | ✅ | ✅ (مدارسه) |
| visits.view.all | ✅ | ✅ | ❌ | ❌ |
| visits.view.department | ✅ | ✅ | ✅ | ❌ |
| visits.view.own | ✅ | ✅ | ✅ | ✅ |
| visits.create/update/finalize | ✅ | ✅ | ❌ | ✅ (مدارسه) |
| forms.review | ✅ | ✅ | ✅ | ❌ |
| reviews.* | كما الزيارات | | | |
| reports.global | ✅ | ✅ | ❌ | ❌ |
| reports.department | ✅ | ✅ | ✅ | ❌ |
| audit.view / backup.manage / settings.manage | ✅ | ❌ | ❌ | ❌ |

> **رئيس التوجيه = صلاحيات كاملة (super)**: تتجاوز Policies دائمًا (يُتحقق أولًا في `Gate::before`).

---

## 4. آلية الحماية (Enforcement)

### طبقات ثلاث:
1. **Gate::before** — رئيس التوجيه يمرّ دائمًا.
2. **Policies** — لكل موديل (`VisitPolicy`, `SchoolPolicy` ...) تتحقق من المفتاح + النطاق.
3. **Middleware `CheckPermission`** — على مستوى المسار: `->middleware('can:visits.view.all')` أو middleware مخصّص يقرأ `permissions`.

### حدود النطاق (Scoping):
- **الموجه**: يرى فقط ما يخص مدارسه (`school_assignments` حيث `supervisor_id = auth id`).
- **رئيس القسم**: يرى فقط ما يخص `department_id` الخاص به.
- **الإدارة (مستوى 1)**: كل شيء.

يُطبَّق النطاق عبر **Query Scopes** في الموديلات (`scopeVisibleTo($user)`) إضافةً للـ Policies.

---

## 5. Trait `HasRoles` / `HasPermissions` (مرجع التنفيذ)
```
$user->hasRole('supervisor')
$user->can('visits.create')        // عبر Gate/Policy
$user->permissions()               // اتحاد صلاحيات كل أدواره
$user->isLevel(1)                  // فحص المستوى الإداري
$user->scopedDepartmentIds()       // للنطاق
```

---

## 6. الواجهة (Frontend)
- تُشارَك صلاحيات المستخدم عبر `HandleInertiaRequests::share(['auth' => ['user', 'permissions']])`.
- Hook `usePermissions()` + مكوّن `<Can permission="visits.create">…</Can>` لإخفاء/إظهار العناصر.
- **الإخفاء في الواجهة ليس أمانًا** — التحقق الحقيقي دائمًا في الـ Backend.
