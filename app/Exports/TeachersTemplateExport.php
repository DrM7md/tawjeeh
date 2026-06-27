<?php

namespace App\Exports;

/** قالب استيراد معلمي القسم (فارغ مع مثال وإرشادات). */
class TeachersTemplateExport extends FormalExport
{
    public function __construct(
        private readonly ?string $schoolName = null,
        private readonly ?string $departmentName = null,
        private readonly ?string $yearName = null,
    ) {}

    protected function reportTitle(): string
    {
        $dept = $this->departmentName ? " — {$this->departmentName}" : '';

        return "قالب استيراد المعلمين{$dept}";
    }

    protected function subtitle(): string
    {
        $parts = array_filter([
            $this->schoolName ? "المدرسة: {$this->schoolName}" : null,
            $this->yearName ? "العام: {$this->yearName}" : null,
            'املأ البيانات تحت العناوين',
        ]);

        return implode('   —   ', $parts);
    }

    protected function columns(): array
    {
        return [
            'اسم الموظف', 'الرقم الوظيفي', 'الرقم الشخصي', 'الجنس', 'الجنسية', 'تاريخ الميلاد',
            'اسم المدرسة', 'نوع المدرسة', 'المرحلة', 'المسمى الوظيفي', 'الدرجة العلمية', 'التخصص العلمي',
            'تاريخ التعيين في الوزارة', 'مستوى الرخصة المهنية', 'سنة الحصول على الرخصة', 'المنطقة السكنية',
            'البريد الإلكتروني', 'رقم الهاتف',
        ];
    }

    protected function rows(): array
    {
        return [];
    }

    protected function validations(): array
    {
        return [
            'D' => ['ذكر', 'أنثى'],                  // الجنس
            'H' => ['بنين', 'بنات'],                 // نوع المدرسة
            'I' => ['ابتدائي', 'إعدادي', 'ثانوي'],  // المرحلة
            'J' => ['معلم', 'منسق'],                 // المسمى الوظيفي
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 26, 'B' => 13, 'C' => 16, 'D' => 9, 'E' => 12, 'F' => 14,
            'G' => 26, 'H' => 12, 'I' => 12, 'J' => 13, 'K' => 14, 'L' => 18,
            'M' => 18, 'N' => 16, 'O' => 14, 'P' => 16, 'Q' => 24, 'R' => 14,
        ];
    }
}
