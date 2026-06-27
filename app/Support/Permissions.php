<?php

namespace App\Support;

/**
 * السجل المركزي لمفاتيح الصلاحيات والأدوار النظامية.
 * المرجع: Brain/03-RBAC.md
 */
class Permissions
{
    // الأدوار النظامية
    public const ROLE_HEAD = 'head_of_guidance';      // رئيس التوجيه (super)
    public const ROLE_ASSISTANT = 'assistant_head';   // مساعد رئيس التوجيه
    public const ROLE_DEPARTMENT_HEAD = 'department_head'; // رئيس القسم
    public const ROLE_SUPERVISOR = 'supervisor';      // موجه

    /**
     * كل مفاتيح الصلاحيات مجمّعة حسب الوحدة (للعرض في محرّر الأدوار + تسجيلها كـ Gates).
     *
     * @return array<string, array{label:string, permissions: array<string,string>}>
     */
    public static function groups(): array
    {
        return [
            'users' => ['label' => 'المستخدمون', 'permissions' => [
                'users.view' => 'عرض المستخدمين',
                'users.create' => 'إضافة مستخدم',
                'users.update' => 'تعديل مستخدم',
                'users.delete' => 'حذف مستخدم',
            ]],
            'roles' => ['label' => 'الأدوار', 'permissions' => [
                'roles.view' => 'عرض الأدوار',
                'roles.manage' => 'إدارة الأدوار والصلاحيات',
            ]],
            'departments' => ['label' => 'الأقسام', 'permissions' => [
                'departments.view' => 'عرض الأقسام',
                'departments.manage' => 'إدارة الأقسام',
            ]],
            'schools' => ['label' => 'المدارس', 'permissions' => [
                'schools.view' => 'عرض المدارس',
                'schools.manage' => 'إدارة المدارس',
            ]],
            'coordinators' => ['label' => 'المنسقون', 'permissions' => [
                'coordinators.view' => 'عرض المنسقين',
                'coordinators.manage' => 'إدارة المنسقين (تنزيل/تعديل)',
            ]],
            'classification' => ['label' => 'التصنيف ومتطلبات المتابعة', 'permissions' => [
                'classification.view' => 'عرض لوحة التصنيف والالتزام',
                'classification.classify' => 'تصنيف معلم/منسق',
                'classification.approve' => 'اعتماد التصنيف',
            ]],
            'academic' => ['label' => 'الأعوام والفصول', 'permissions' => [
                'academic.view' => 'عرض الأعوام والفصول',
                'academic.manage' => 'إدارة الأعوام والفصول',
            ]],
            'distribution' => ['label' => 'توزيع المدارس', 'permissions' => [
                'distribution.view' => 'عرض التوزيع',
                'distribution.auto' => 'توزيع تلقائي',
                'distribution.manual' => 'توزيع يدوي',
                'distribution.redistribute' => 'إعادة توزيع',
            ]],
            'import' => ['label' => 'الاستيراد', 'permissions' => [
                'import.view' => 'عرض سجل الاستيراد',
                'import.run' => 'تنفيذ استيراد',
            ]],
            'planning' => ['label' => 'التخطيط (خطة الموجّه)', 'permissions' => [
                'planning.view.own' => 'عرض خطته',
                'planning.view.department' => 'عرض خطط القسم',
                'planning.create' => 'إنشاء/تعديل الخطة',
                'planning.approve' => 'اعتماد/إرجاع الخطة',
            ]],
            'visits' => ['label' => 'الزيارات', 'permissions' => [
                'visits.view.own' => 'عرض زياراته',
                'visits.view.department' => 'عرض زيارات القسم',
                'visits.view.all' => 'عرض كل الزيارات',
                'visits.create' => 'إنشاء زيارة',
                'visits.update' => 'تعديل زيارة',
                'visits.finalize' => 'اعتماد زيارة',
            ]],
            'forms' => ['label' => 'الاستمارات', 'permissions' => [
                'forms.fill' => 'تعبئة الاستمارة',
                'forms.finalize' => 'اعتماد الاستمارة',
                'forms.review' => 'مراجعة الاستمارات',
            ]],
            'reviews' => ['label' => 'تحكيم الاختبارات', 'permissions' => [
                'reviews.view.own' => 'عرض تحكيماته',
                'reviews.view.department' => 'عرض تحكيمات القسم',
                'reviews.view.all' => 'عرض كل التحكيمات',
                'reviews.create' => 'إنشاء تحكيم',
                'reviews.finalize' => 'اعتماد تحكيم',
            ]],
            'portfolios' => ['label' => 'تقييم ملفات المنسق', 'permissions' => [
                'portfolios.view.own' => 'عرض تقييماته',
                'portfolios.view.department' => 'عرض تقييمات القسم',
                'portfolios.view.all' => 'عرض كل التقييمات',
                'portfolios.create' => 'إنشاء تقييم ملفات',
                'portfolios.finalize' => 'اعتماد تقييم ملفات',
            ]],
            'improvement' => ['label' => 'خطط التحسين والتطوير', 'permissions' => [
                'improvement.view.own' => 'عرض خططه',
                'improvement.view.department' => 'عرض خطط القسم',
                'improvement.view.all' => 'عرض كل الخطط',
                'improvement.create' => 'إنشاء خطة',
                'improvement.update' => 'تعديل خطة وإضافة مراجعات',
            ]],
            'reports' => ['label' => 'المؤشرات والتقارير', 'permissions' => [
                'reports.department' => 'تقارير القسم',
                'reports.global' => 'التقارير الشاملة',
                'reports.export' => 'تصدير التقارير',
            ]],
            'system' => ['label' => 'النظام', 'permissions' => [
                'audit.view' => 'عرض سجل النشاط',
                'backup.manage' => 'إدارة النسخ الاحتياطي',
                'settings.manage' => 'إدارة الإعدادات',
            ]],
        ];
    }

    /** قائمة مسطّحة بكل مفاتيح الصلاحيات. @return list<string> */
    public static function all(): array
    {
        $keys = [];
        foreach (self::groups() as $group) {
            foreach ($group['permissions'] as $key => $label) {
                $keys[] = $key;
            }
        }

        return $keys;
    }

    /** الصلاحيات الافتراضية لكل دور نظامي. @return array<string, list<string>> */
    public static function defaults(): array
    {
        $all = self::all();

        $assistant = array_values(array_diff($all, [
            'roles.manage', 'audit.view', 'backup.manage', 'settings.manage',
        ]));

        $departmentHead = [
            'users.view',
            'departments.view',
            'schools.view', 'schools.manage',
            'coordinators.view', 'coordinators.manage',
            'classification.view', 'classification.classify', 'classification.approve',
            'academic.view',
            'distribution.view', 'distribution.auto', 'distribution.manual', 'distribution.redistribute',
            'import.view', 'import.run',
            'planning.view.own', 'planning.view.department', 'planning.approve',
            'visits.view.own', 'visits.view.department',
            'forms.review',
            'reviews.view.own', 'reviews.view.department',
            'portfolios.view.own', 'portfolios.view.department',
            'improvement.view.own', 'improvement.view.department', 'improvement.create', 'improvement.update',
            'reports.department', 'reports.export',
        ];

        $supervisor = [
            'schools.view',
            'coordinators.view',
            'classification.view', 'classification.classify',
            'academic.view',
            'import.view', 'import.run',
            'planning.view.own', 'planning.create',
            'visits.view.own', 'visits.create', 'visits.update', 'visits.finalize',
            'forms.fill', 'forms.finalize',
            'reviews.view.own', 'reviews.create', 'reviews.finalize',
            'portfolios.view.own', 'portfolios.create', 'portfolios.finalize',
            'improvement.view.own', 'improvement.create', 'improvement.update',
        ];

        return [
            self::ROLE_HEAD => $all, // super — يتجاوز عبر Gate::before أيضًا
            self::ROLE_ASSISTANT => $assistant,
            self::ROLE_DEPARTMENT_HEAD => $departmentHead,
            self::ROLE_SUPERVISOR => $supervisor,
        ];
    }
}
