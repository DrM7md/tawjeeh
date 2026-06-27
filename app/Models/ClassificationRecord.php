<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * سجلّ تصنيف معلم في مرحلة من مراحل العام (مبدئي/منتصف/نهائي).
 * يحفظ الأساس (تقييم سنوي/ملاحظة الموجه) والدرجة والفئة الناتجة وحالة الاعتماد.
 */
class ClassificationRecord extends Model
{
    use Auditable, BelongsToAcademicContext; // مرتبط بالعام + الفصل

    public const STAGE_INITIAL = 'initial';
    public const STAGE_MIDYEAR = 'midyear';
    public const STAGE_FINAL = 'final';

    public const BASIS_ANNUAL = 'annual_eval';
    public const BASIS_OBSERVATION = 'supervisor_observation';

    public const STATUS_DRAFT = 'draft';
    public const STATUS_APPROVED = 'approved';

    public const STAGES = [self::STAGE_INITIAL, self::STAGE_MIDYEAR, self::STAGE_FINAL];
    public const BASES = [self::BASIS_ANNUAL, self::BASIS_OBSERVATION];

    protected $fillable = [
        'academic_year_id', 'semester_id', 'teacher_id', 'teacher_classification_id',
        'stage', 'basis', 'score', 'status', 'note', 'created_by', 'approved_by', 'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    public function scopeApproved($query)
    {
        return $query->where('status', self::STATUS_APPROVED);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function classification(): BelongsTo
    {
        return $this->belongsTo(TeacherClassification::class, 'teacher_classification_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }
}
