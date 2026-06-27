<?php

namespace App\Notifications;

use App\Support\Permissions;

/**
 * السجل المركزي لأنواع الإشعارات القابلة للضبط.
 * لإضافة نوع جديد: أضِف ثابتًا + مدخلًا في catalog()، ثم أرسِله عبر NotificationDispatcher.
 */
class NotificationType
{
    public const VISIT_ASSIGNED = 'visit_assigned';

    public const REVIEW_ASSIGNED = 'review_assigned';

    public const PORTFOLIO_REVIEWED = 'portfolio_reviewed';

    public const PLAN_SUBMITTED = 'plan_submitted';

    public const PLAN_REVIEWED = 'plan_reviewed';

    public const IMPROVEMENT_REVIEW_DUE = 'improvement_review_due';

    /**
     * تعريف كل نوع: التسمية، الوصف، أيقونة الواجهة، والمستلمون الافتراضيون.
     *
     * @return array<string, array{label:string, description:string, icon:string, default_roles: list<string>, default_department_scoped: bool}>
     */
    public static function catalog(): array
    {
        return [
            self::VISIT_ASSIGNED => [
                'label' => 'زيارة جديدة',
                'description' => 'عند تسجيل موجّه لزيارة صفية جديدة — يصل لرؤساء الأقسام المعنيّين.',
                'icon' => 'visit',
                'default_roles' => [Permissions::ROLE_DEPARTMENT_HEAD, Permissions::ROLE_ASSISTANT],
                'default_department_scoped' => true,
            ],
            self::REVIEW_ASSIGNED => [
                'label' => 'تحكيم اختبار جديد',
                'description' => 'عند إنشاء موجّه لسجل تحكيم اختبار جديد — يصل لرؤساء الأقسام المعنيّين.',
                'icon' => 'review',
                'default_roles' => [Permissions::ROLE_DEPARTMENT_HEAD, Permissions::ROLE_ASSISTANT],
                'default_department_scoped' => true,
            ],
            self::PORTFOLIO_REVIEWED => [
                'label' => 'تقييم ملفات منسق جديد',
                'description' => 'عند إنشاء موجّه لسجل تقييم ملفات منسق — يصل لرؤساء الأقسام المعنيّين.',
                'icon' => 'review',
                'default_roles' => [Permissions::ROLE_DEPARTMENT_HEAD, Permissions::ROLE_ASSISTANT],
                'default_department_scoped' => true,
            ],
            self::PLAN_SUBMITTED => [
                'label' => 'خطة موجّه بانتظار الاعتماد',
                'description' => 'عند إرسال موجّه لخطة زياراته للاعتماد — تصل لرئيس القسم المعنيّ.',
                'icon' => 'visit',
                'default_roles' => [Permissions::ROLE_DEPARTMENT_HEAD, Permissions::ROLE_ASSISTANT],
                'default_department_scoped' => true,
            ],
            self::PLAN_REVIEWED => [
                'label' => 'نتيجة اعتماد الخطة',
                'description' => 'عند اعتماد رئيس القسم لخطة الموجّه أو إرجاعها — تصل للموجّه صاحب الخطة.',
                'icon' => 'visit',
                'default_roles' => [Permissions::ROLE_SUPERVISOR],
                'default_department_scoped' => true,
            ],
            self::IMPROVEMENT_REVIEW_DUE => [
                'label' => 'مراجعة خطة تحسين مستحقّة',
                'description' => 'تذكير آلي عند تأخّر المراجعة الشهرية لخطة تحسين نشطة — يصل للموجّه صاحب الخطة.',
                'icon' => 'review',
                'default_roles' => [Permissions::ROLE_SUPERVISOR],
                'default_department_scoped' => true,
            ],
        ];
    }

    /** @return list<string> */
    public static function keys(): array
    {
        return array_keys(self::catalog());
    }

    /** @return array{label:string, description:string, icon:string, default_roles: list<string>, default_department_scoped: bool}|null */
    public static function definition(string $type): ?array
    {
        return self::catalog()[$type] ?? null;
    }
}
