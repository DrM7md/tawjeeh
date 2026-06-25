<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;

class SchoolTemplateExport implements FromArray, WithHeadings
{
    public function headings(): array
    {
        return ['المدرسة', 'المرحلة', 'المادة', 'المنسق', 'المعلم', 'التصنيف', 'عدد الشعب'];
    }

    public function array(): array
    {
        return [
            ['مدرسة الأمل الإعدادية', 'إعدادي', 'الرياضيات', 'أحمد علي', 'خالد حسن', 'متميز', 4],
            ['مدرسة النور الثانوية', 'ثانوي', 'العلوم', 'سعاد محمد', 'منى سالم', 'يحتاج دعم', 5],
        ];
    }
}
