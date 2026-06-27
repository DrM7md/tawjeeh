<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToAcademicContext;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * تكليف معلم بمهمة التنسيق. المنسق = معلم له تكليف نشط في العام المختار.
 * مرتبط بالعام فقط (لا فصل). يُسجَّل تلقائيًا في سجل التدقيق.
 */
class CoordinatorAssignment extends Model
{
    use Auditable, BelongsToAcademicContext;

    protected bool $usesSemester = false;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_ENDED = 'ended';

    protected $fillable = [
        'academic_year_id', 'teacher_id', 'school_id', 'department_id',
        'start_date', 'end_date', 'status', 'ended_reason', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** نهاية الفترة المحتسبة: تاريخ الانتهاء إن وُجد، وإلا اليوم. */
    public function tenureEnd(): CarbonInterface
    {
        return $this->end_date ?? now();
    }

    /** عدد الأشهر الكاملة لمدة التنسيق. */
    public function tenureMonths(): int
    {
        return $this->start_date->diffInMonths($this->tenureEnd());
    }

    /** مدة التنسيق بصيغة عربية: «س سنة و ش شهر». */
    public function tenureLabel(): string
    {
        $months = $this->tenureMonths();
        $years = intdiv($months, 12);
        $rem = $months % 12;

        $parts = [];
        if ($years > 0) {
            $parts[] = $years.' '.($years === 1 ? 'سنة' : ($years === 2 ? 'سنتان' : 'سنوات'));
        }
        if ($rem > 0) {
            $parts[] = $rem.' '.($rem === 1 ? 'شهر' : ($rem === 2 ? 'شهران' : 'أشهر'));
        }

        return $parts === [] ? 'أقل من شهر' : implode(' و', $parts);
    }
}
