# 🗄️ مخطط قاعدة البيانات (Database Schema)

> MySQL. كل الجداول `utf8mb4_unicode_ci`. كل جدول يحوي `id`, `created_at`, `updated_at` ما لم يُذكر خلاف ذلك.
> الجداول الموسومة بـ 🗓️ مرتبطة بالعام الدراسي، وبـ 📖 مرتبطة بالفصل الدراسي.

---

## 1. مخطط العلاقات (نصّي)

```
departments ──< users (موجهون/رؤساء أقسام)
departments ──< teachers / coordinators / test_reviews

academic_years ──< semesters
academic_years ──< (school_assignments, teachers, coordinators, visits,
                    visit_forms, test_reviews, attachments, performance_indicators)
semesters ──< (visits, visit_forms, test_reviews, attachments, performance_indicators)

schools ──< school_assignments >── users (الموجه)
schools ──< coordinators ──< teachers
schools ──< visits
schools ──< test_reviews

teacher_classifications ──< teachers
visits ──1:1── visit_forms ──< visit_files
visits ──< attachments (polymorphic)
test_reviews ──1:1── test_review_forms

users ──< notifications
* ──< audit_logs (polymorphic)
roles >──< users (role_user pivot)
```

---

## 2. الجداول

### 2.1 `users`
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| name | string | |
| email | string unique | |
| password | string | |
| department_id | FK→departments nullable | null لإدارة التوجيه (المستوى الأول) |
| phone | string nullable | |
| is_active | boolean default true | |
| last_login_at | timestamp nullable | |
| remember_token, email_verified_at | | قياسي |

### 2.2 `roles` + `role_user`
`roles`:
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| name | string unique | المعرّف البرمجي: `head_of_guidance`, `assistant_head`, `department_head`, `supervisor` |
| display_name | string | الاسم العربي المعروض |
| level | tinyint | 1=إدارة، 2=رئيس قسم، 3=موجه |
| permissions | json | مصفوفة مفاتيح الصلاحيات |
| is_system | boolean | أدوار النظام لا تُحذف |

`role_user` (pivot): `user_id`, `role_id`. (مفصّل في [`03-RBAC.md`](03-RBAC.md))

### 2.3 `departments` (الأقسام — 10)
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| name | string | اسم القسم |
| code | string nullable | رمز مختصر |
| head_user_id | FK→users nullable | رئيس القسم |
| color | string nullable | لون تمييزي للواجهة |
| is_active | boolean default true | |

### 2.4 `stages` (المراحل الدراسية)
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| name | string | ابتدائي / إعدادي / ثانوي |
| code | string | `primary` / `preparatory` / `secondary` |
| sort_order | int | |

### 2.5 `schools` (المدارس)
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| name | string | |
| code | string nullable unique | الرقم/الرمز الوزاري |
| stage_id | FK→stages nullable | المرحلة الأساسية (قد تكون مشتركة) |
| gender | enum(boys,girls,mixed) nullable | |
| address / zone | string nullable | للخرائط مستقبلًا |
| is_active | boolean default true | |

> ملاحظة: قد تخدم المدرسة أكثر من مرحلة؛ تُشتق المراحل الفعلية من بيانات المعلمين المستوردة.

### 2.6 `academic_years` 🗓️
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| name | string | مثل «2026–2027» |
| start_date | date | |
| end_date | date | |
| is_active | boolean default false | **واحد فقط = true** (قاعدة 1) |
| status | enum(active,closed,archived) | |
| created_by | FK→users nullable | |

### 2.7 `semesters` 🗓️
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| academic_year_id | FK→academic_years | |
| name | string | الفصل الأول / الفصل الثاني |
| start_date / end_date | date | |
| is_active | boolean default false | **واحد فقط نشط داخل العام** (قاعدة semester-2) |
| status | enum(not_started,active,ended,closed) | |

### 2.8 `school_assignments` (توزيع المدارس) 🗓️
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| academic_year_id | FK | |
| school_id | FK→schools | |
| supervisor_id | FK→users | الموجه |
| department_id | FK→departments | القسم/المادة |
| assignment_method | enum(auto,manual) | |
| assigned_by | FK→users nullable | |
| notes | text nullable | |

UNIQUE(`academic_year_id`,`school_id`,`department_id`) — مدرسة واحدة لقسم واحد لموجه واحد في العام.

### 2.9 `teacher_classifications` (تصنيفات المعلمين)
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| name | string | يحتاج دعم / متوسط / متميز |
| code | string | `needs_support` / `average` / `distinguished` |
| required_visits | tinyint | عدد الزيارات المطلوبة للمعلم (مثلًا 3/2/1) |
| color | string nullable | |

### 2.10 `coordinators` (المنسقون) 🗓️
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| academic_year_id | FK | |
| school_id | FK→schools | |
| department_id | FK→departments | المادة |
| stage_id | FK→stages nullable | |
| name | string | |
| phone / email | string nullable | |

### 2.11 `teachers` (المعلمون) 🗓️
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| academic_year_id | FK | |
| school_id | FK→schools | |
| department_id | FK→departments | المادة |
| coordinator_id | FK→coordinators nullable | |
| stage_id | FK→stages nullable | |
| classification_id | FK→teacher_classifications nullable | |
| name | string | |
| sections_count | int default 0 | عدد الشعب |
| phone / email | string nullable | |

### 2.12 `import_batches` (دفعات الاستيراد) 🗓️
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| academic_year_id | FK | |
| user_id | FK→users | من قام بالاستيراد |
| original_filename | string | |
| status | enum(pending,processing,completed,failed) | |
| total_rows / imported_rows / updated_rows / failed_rows | int | |
| summary | json nullable | إحصائيات + كشف التكرار |

### 2.13 `import_errors`
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| import_batch_id | FK→import_batches | |
| row_number | int | |
| column | string nullable | |
| message | string | سبب الخطأ |
| raw_data | json | الصف الأصلي |

### 2.14 `visits` (الزيارات) 🗓️📖
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| academic_year_id | FK | |
| semester_id | FK→semesters | |
| supervisor_id | FK→users | الموجه |
| school_id | FK→schools | |
| department_id | FK→departments | |
| visit_type | enum(teacher,coordinator) | |
| visitable_type / visitable_id | morphs | يشير لـ teacher أو coordinator |
| visit_date | date | |
| status | enum(scheduled,done,late) | يُحسب جزئيًا منطقيًا |
| created_by | FK→users | |

### 2.15 `visit_forms` (استمارات الزيارة) 🗓️📖
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| visit_id | FK→visits unique | 1:1 |
| school_snapshot | json | بيانات المدرسة وقت الزيارة |
| target_snapshot | json | بيانات المستهدف |
| axes | json | محاور التقييم ودرجاتها |
| notes | text nullable | الملاحظات |
| recommendations | text nullable | التوصيات |
| signature | text nullable | التوقيع الإلكتروني (base64/مسار) |
| save_status | enum(draft,final) | مسودة / اعتماد نهائي |
| finalized_at | timestamp nullable | |

### 2.16 `visit_files` (مرفقات الزيارة)
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| visit_form_id | FK→visit_forms | |
| path | string | مسار التخزين الخاص |
| original_name / mime / size | | |

### 2.17 `test_reviews` (تحكيم الاختبارات) 🗓️📖
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| academic_year_id | FK | |
| semester_id | FK→semesters | |
| supervisor_id | FK→users | |
| school_id | FK→schools | |
| department_id | FK→departments | المادة |
| stage_id | FK→stages | إعدادي/ثانوي/مشتركة |
| grade | string nullable | السابع/الثامن/التاسع/ثانوي |
| status | enum(draft,final) | |
| reviewed_at | date nullable | |

### 2.18 `test_review_forms`
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| test_review_id | FK unique | 1:1 |
| criteria | json | المعايير ودرجاتها |
| total_score | decimal nullable | |
| notes | text nullable | |
| result | string nullable | نتيجة مؤرشفة |

### 2.19 `attachments` (مرفقات عامة — polymorphic) 🗓️📖
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| academic_year_id / semester_id | FK nullable | |
| attachable_type / attachable_id | morphs | أي كيان |
| path / original_name / mime / size | | تخزين خاص |
| uploaded_by | FK→users | |

### 2.20 `performance_indicators` (المؤشرات المحسوبة/المخزّنة) 🗓️📖
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| academic_year_id / semester_id | FK | |
| scope_type | enum(department,supervisor,school,global) | |
| scope_id | bigint nullable | |
| metric_key | string | مثل `visits_completion_rate` |
| metric_value | decimal | |
| computed_at | timestamp | للـ caching |

> قد تُحسب المؤشرات لحظيًا (queries) أو تُخزّن دوريًا عبر Job. هذا الجدول للتخزين المؤقت/التاريخي.

### 2.21 `notifications`
نستخدم جدول Laravel القياسي `notifications` (UUID, type, notifiable, data json, read_at).

### 2.22 `audit_logs` (سجل النشاط)
| الحقل | النوع | ملاحظات |
|------|------|---------|
| id | bigint PK | |
| user_id | FK→users nullable | |
| action | string | created/updated/deleted/login... |
| auditable_type / auditable_id | morphs nullable | |
| old_values / new_values | json nullable | |
| ip_address / user_agent | string nullable | |

---

## 3. ملخّص الأعمدة السياقية

| الجدول | academic_year_id | semester_id |
|--------|:---:|:---:|
| school_assignments | ✅ | — |
| teachers | ✅ | — |
| coordinators | ✅ | — |
| import_batches | ✅ | — |
| visits | ✅ | ✅ |
| visit_forms | ✅ | ✅ |
| test_reviews | ✅ | ✅ |
| attachments | ✅ | ✅ (nullable) |
| performance_indicators | ✅ | ✅ |

---

## 4. الفهارس المقترحة (الأداء)
- فهارس على كل المفاتيح الأجنبية (Laravel يضيفها افتراضيًا للـ constrained).
- فهرس مركّب على `visits(academic_year_id, semester_id, supervisor_id, status)`.
- فهرس مركّب على `school_assignments(academic_year_id, supervisor_id)`.
- فهرس على `academic_years(is_active)` و`semesters(academic_year_id, is_active)`.

---

## 5. ملاحظات الترحيل (Migrations) — ترتيب الإنشاء
1. stages, departments, teacher_classifications (مرجعية)
2. users, roles, role_user
3. academic_years, semesters
4. schools
5. school_assignments
6. coordinators, teachers
7. import_batches, import_errors
8. visits, visit_forms, visit_files
9. test_reviews, test_review_forms
10. attachments
11. performance_indicators
12. notifications, audit_logs
