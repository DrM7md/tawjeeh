<?php

namespace App\Exports;

/** قالب استيراد الموجّهين (فارغ مع إرشادات). */
class UsersTemplateExport extends FormalExport
{
    protected function reportTitle(): string
    {
        return 'قالب استيراد الموجّهين';
    }

    protected function subtitle(): string
    {
        return 'املأ البيانات تحت العناوين   —   تاريخ الإصدار: '.now()->format('Y-m-d');
    }

    protected function columns(): array
    {
        return ['الاسم', 'البريد الإلكتروني', 'رقم الهاتف', 'القسم', 'النوع'];
    }

    protected function rows(): array
    {
        return [];
    }

    protected function validations(): array
    {
        return [
            'E' => ['ذكر', 'أنثى'], // النوع
        ];
    }

    protected function note(): ?string
    {
        return 'يُنشأ لكل صف حساب «موجه» نشط بكلمة المرور الافتراضية: tawjeeh@1234 (يُنصح بتغييرها بعد أول دخول).   '
            .'البريد الإلكتروني مطلوب وفريد (يُستخدم لتمييز التحديث).   '
            .'«القسم» يجب أن يطابق اسم قسم موجود تمامًا، واتركه فارغًا لمستخدمي إدارة التوجيه.   '
            .'«النوع» اكتب «ذكر» أو «أنثى» (يُستخدم لتوزيع مدارس البنين/البنات)، واتركه فارغًا إن لم يلزم.';
    }

    public function columnWidths(): array
    {
        return ['A' => 28, 'B' => 28, 'C' => 16, 'D' => 22, 'E' => 10];
    }
}
