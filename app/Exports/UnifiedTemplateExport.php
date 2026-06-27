<?php

namespace App\Exports;

/**
 * قالب الاستيراد الموحّد (مدارس + معلمون + تحديد المنسق) — فارغ مع قوائم منسدلة للتحقّق.
 * صف واحد لكل معلم؛ بيانات المدرسة تتكرّر مع معلميها.
 */
class UnifiedTemplateExport extends FormalExport
{
    /**
     * @param  list<string>  $stages  أسماء المراحل المتاحة
     * @param  list<string>  $departments  أسماء الأقسام المتاحة
     */
    public function __construct(
        private readonly array $stages = [],
        private readonly array $departments = [],
        private readonly ?string $yearName = null,
    ) {}

    protected function reportTitle(): string
    {
        return 'قالب الاستيراد الموحّد (المدارس والمعلمون والمنسقون)';
    }

    protected function subtitle(): string
    {
        $year = $this->yearName ? "العام الدراسي: {$this->yearName}   —   " : '';

        return $year.'صف واحد لكل معلم — كرّر بيانات المدرسة مع كل معلميها — ضع «نعم» في عمود «منسق» للمنسق';
    }

    protected function columns(): array
    {
        return [
            'اسم المدرسة', 'المرحلة', 'نوع المدرسة', 'مدير المدرسة', 'إيميل المدرسة',
            'القسم', 'اسم المعلم', 'الرقم الشخصي', 'الرقم الوظيفي', 'الجنس', 'الجنسية',
            'تاريخ الميلاد', 'المسمى الوظيفي', 'الدرجة العلمية', 'التخصص العلمي',
            'تاريخ التعيين', 'مستوى الرخصة', 'سنة الرخصة', 'المنطقة السكنية',
            'البريد الإلكتروني', 'رقم الهاتف', 'منسق', 'تاريخ التنسيق',
        ];
    }

    protected function rows(): array
    {
        return [];
    }

    protected function validations(): array
    {
        return array_filter([
            'B' => $this->stages,                       // المرحلة
            'C' => ['بنين', 'بنات', 'مشترك'],           // نوع المدرسة
            'F' => $this->departments,                  // القسم
            'J' => ['ذكر', 'أنثى'],                     // الجنس
            'V' => ['نعم', 'لا'],                       // منسق
        ], fn ($v) => $v !== []);
    }

    public function columnWidths(): array
    {
        return [
            'A' => 28, 'B' => 12, 'C' => 12, 'D' => 22, 'E' => 24, 'F' => 16, 'G' => 26,
            'H' => 15, 'I' => 13, 'J' => 8, 'K' => 12, 'L' => 13, 'M' => 16, 'N' => 14,
            'O' => 18, 'P' => 14, 'Q' => 14, 'R' => 11, 'S' => 16, 'T' => 24, 'U' => 14,
            'V' => 8, 'W' => 14,
        ];
    }
}
