<?php

namespace App\Exports;

use Illuminate\Support\Collection;

/** تصدير كشف معلمي قسم في مدرسة (مع الصفوف والنصاب). */
class TeachersDataExport extends FormalExport
{
    private const GENDERS = ['male' => 'ذكر', 'female' => 'أنثى'];

    /** @param Collection<int,\App\Models\Teacher> $teachers */
    public function __construct(
        private readonly Collection $teachers,
        private readonly ?string $schoolName = null,
        private readonly ?string $departmentName = null,
        private readonly ?string $yearName = null,
    ) {}

    protected function reportTitle(): string
    {
        $dept = $this->departmentName ? " — {$this->departmentName}" : '';

        return "كشف المعلمين{$dept}";
    }

    protected function subtitle(): string
    {
        $parts = array_filter([
            $this->schoolName ? "المدرسة: {$this->schoolName}" : null,
            $this->yearName ? "العام: {$this->yearName}" : null,
            'تاريخ الإصدار: '.now()->format('Y-m-d'),
        ]);

        return implode('   —   ', $parts);
    }

    protected function columns(): array
    {
        return [
            'م', 'اسم الموظف', 'الرقم الوظيفي', 'الرقم الشخصي', 'الجنس', 'الجنسية', 'تاريخ الميلاد',
            'المسمى الوظيفي', 'الدرجة العلمية', 'التخصص العلمي', 'تاريخ التعيين', 'مستوى الرخصة',
            'سنة الرخصة', 'المنطقة السكنية', 'الصفوف', 'النصاب', 'البريد الإلكتروني', 'رقم الهاتف',
        ];
    }

    protected function rows(): array
    {
        return $this->teachers->values()->map(function ($t, $i) {
            return [
                $i + 1,
                $t->name,
                $t->employee_no ?: '—',
                $t->national_id ?: '—',
                self::GENDERS[$t->gender] ?? '—',
                $t->nationality ?: '—',
                $t->birth_date?->format('Y-m-d') ?? '—',
                $t->job_title ?: '—',
                $t->academic_degree ?: '—',
                $t->specialization ?: '—',
                $t->ministry_hire_date?->format('Y-m-d') ?? '—',
                $t->license_level ?: '—',
                $t->license_year ?: '—',
                $t->residential_zone ?: '—',
                $t->grades->pluck('name')->implode('، ') ?: '—',
                $t->quota ?? '—',
                $t->email ?: '—',
                $t->phone ?: '—',
            ];
        })->all();
    }

    public function columnWidths(): array
    {
        return [
            'A' => 6, 'B' => 26, 'C' => 13, 'D' => 16, 'E' => 9, 'F' => 12, 'G' => 14,
            'H' => 13, 'I' => 14, 'J' => 18, 'K' => 14, 'L' => 16, 'M' => 11, 'N' => 16,
            'O' => 22, 'P' => 9, 'Q' => 24, 'R' => 14,
        ];
    }
}
