<?php

namespace App\Exports;

use Illuminate\Support\Collection;

/** تصدير بيانات المدارس الحالية (مع مدير العام المختار). */
class SchoolsDataExport extends FormalExport
{
    private const GENDERS = ['boys' => 'بنين', 'girls' => 'بنات', 'mixed' => 'مشترك'];

    /** @param Collection<int,\App\Models\School> $schools */
    public function __construct(private readonly Collection $schools, private readonly ?string $yearName = null) {}

    protected function reportTitle(): string
    {
        return 'كشف المدارس';
    }

    protected function subtitle(): string
    {
        $year = $this->yearName ? "العام الدراسي: {$this->yearName}" : '';
        $date = 'تاريخ الإصدار: '.now()->format('Y-m-d');

        return trim($year.($year ? '   —   ' : '').$date);
    }

    protected function columns(): array
    {
        return ['م', 'اسم المدرسة', 'المرحلة', 'النوع', 'المنطقة', 'إيميل المدرسة', 'مدير المدرسة'];
    }

    protected function rows(): array
    {
        return $this->schools->values()->map(function ($s, $i) {
            return [
                $i + 1,
                $s->name,
                $s->stage?->name ?? '—',
                self::GENDERS[$s->gender] ?? '—',
                $s->zone ?: '—',
                $s->email ?: '—',
                $s->principal?->name ?? '—',
            ];
        })->all();
    }

    public function columnWidths(): array
    {
        return ['A' => 6, 'B' => 34, 'C' => 14, 'D' => 12, 'E' => 18, 'F' => 28, 'G' => 30];
    }
}
