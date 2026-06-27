<?php

namespace App\Exports;

/** قالب استيراد المدارس (فارغ مع مثالين وإرشادات). */
class SchoolsTemplateExport extends FormalExport
{
    public function __construct(private readonly ?string $yearName = null) {}

    protected function reportTitle(): string
    {
        return 'قالب استيراد المدارس';
    }

    protected function subtitle(): string
    {
        $year = $this->yearName ? "العام الدراسي: {$this->yearName}   —   " : '';

        return $year.'املأ البيانات تحت العناوين';
    }

    protected function columns(): array
    {
        return ['اسم المدرسة', 'المرحلة', 'النوع', 'إيميل المدرسة', 'مدير المدرسة'];
    }

    protected function rows(): array
    {
        return [];
    }

    protected function validations(): array
    {
        return [
            'B' => ['ابتدائي', 'إعدادي', 'ثانوي'], // المرحلة
            'C' => ['بنين', 'بنات', 'مشترك'],       // النوع
        ];
    }

    public function columnWidths(): array
    {
        return ['A' => 34, 'B' => 14, 'C' => 12, 'D' => 28, 'E' => 30];
    }
}
