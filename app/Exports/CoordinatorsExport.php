<?php

namespace App\Exports;

use App\Models\CoordinatorAssignment;
use Illuminate\Support\Collection;

/** تصدير كشف المنسقين بتنسيق رسمي (الاسم، المادة، المدرسة، تاريخ التعيين، مدة التنسيق، التصنيف، الحالة). */
class CoordinatorsExport extends FormalExport
{
    /** @param Collection<int,CoordinatorAssignment> $assignments */
    public function __construct(
        private readonly Collection $assignments,
        private readonly ?string $yearName = null,
    ) {}

    protected function reportTitle(): string
    {
        return 'كشف المنسقين';
    }

    protected function subtitle(): string
    {
        $parts = array_filter([
            $this->yearName ? "العام: {$this->yearName}" : null,
            'الإجمالي: '.$this->assignments->count(),
            'تاريخ الإصدار: '.now()->format('Y-m-d'),
        ]);

        return implode('   —   ', $parts);
    }

    protected function columns(): array
    {
        return ['م', 'اسم المنسق', 'الرقم الشخصي', 'المادة / القسم', 'المدرسة', 'تاريخ التعيين', 'مدة التنسيق', 'التصنيف الحالي', 'الحالة', 'رقم الهاتف'];
    }

    protected function rows(): array
    {
        return $this->assignments->values()->map(function (CoordinatorAssignment $a, $i) {
            return [
                $i + 1,
                $a->teacher?->name ?: '—',
                $a->teacher?->national_id ?: '—',
                $a->department?->name ?: '—',
                $a->school?->name ?: '—',
                $a->start_date?->format('Y-m-d') ?? '—',
                $a->tenureLabel(),
                $a->teacher?->classification?->name ?: '—',
                $a->status === CoordinatorAssignment::STATUS_ACTIVE ? 'منسق حالي' : 'مُنزَّل لمعلم',
                $a->teacher?->phone ?: '—',
            ];
        })->all();
    }

    public function columnWidths(): array
    {
        return ['A' => 6, 'B' => 26, 'C' => 16, 'D' => 18, 'E' => 28, 'F' => 14, 'G' => 18, 'H' => 16, 'I' => 14, 'J' => 14];
    }
}
