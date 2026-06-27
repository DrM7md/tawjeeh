<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Semester extends Model
{
    protected $fillable = ['academic_year_id', 'name', 'start_date', 'end_date', 'is_active'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /** الفصل «منتهٍ» إذا تجاوز تاريخ نهايته اليوم — يُشتق من التاريخ لا من حالة يدوية. */
    public function hasEnded(): bool
    {
        return (bool) $this->end_date?->isPast();
    }
}
