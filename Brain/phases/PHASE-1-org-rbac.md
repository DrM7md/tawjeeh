# Phase 1 — الهيكل التنظيمي + RBAC

**الهدف:** إدارة الأقسام، المستخدمين، الأدوار/الصلاحيات، المدارس، المراحل + نظام الحماية الكامل.

**يعتمد على:** Phase 0. **يمكّن:** كل الوحدات (الصلاحيات والنطاقات).

---

## المهام

### قاعدة البيانات
- [ ] Migrations: `stages`, `departments`, `teacher_classifications`, `roles`, `role_user`, `schools`, تعديل `users` (department_id, is_active, ...). (انظر [`02-DATABASE.md`](../02-DATABASE.md))
- [ ] Seeders: 10 أقسام، 3 مراحل، 3 تصنيفات، الأدوار الأربعة + مستخدم رئيس توجيه.

### RBAC
- [ ] Trait `HasRoles`/`HasPermissions` + `Gate::before` (super = رئيس التوجيه).
- [ ] Policies: User, Department, School, Role.
- [ ] Middleware `CheckPermission` + Query Scopes (`scopeVisibleTo`).
- [ ] مشاركة `auth.user` + `permissions` عبر Inertia + Hook `usePermissions` + `<Can>`.

### الوحدات (CRUD عبر Modals)
- [ ] **الأقسام**: قائمة + إضافة/تعديل + تعيين رئيس قسم + لون.
- [ ] **المستخدمون**: قائمة + إضافة/تعديل + إسناد دور + قسم + تفعيل/تعطيل + إعادة تعيين كلمة مرور.
- [ ] **الأدوار**: قائمة + محرّر صلاحيات (مصفوفة checkboxes حسب module.action).
- [ ] **المدارس**: قائمة + إضافة/تعديل + مرحلة/نوع + تفعيل.
- [ ] **المراحل + التصنيفات**: شاشات إعداد بسيطة (settings).

### الخدمات
- [ ] `UserService`, `RoleService`, `SchoolService`, `DepartmentService` + Repositories.

---

## معايير القبول
- رئيس التوجيه يدير المستخدمين والأدوار والأقسام والمدارس.
- الصلاحيات تُطبَّق فعليًا (موجه لا يصل لإدارة المستخدمين).
- النطاقات تعمل (رئيس قسم يرى قسمه فقط).
- كل CRUD عبر Modals (لا صفحات منفصلة) — راجع [feedback_modal_crud].
- اختبارات Feature للصلاحيات الأساسية تمرّ.
