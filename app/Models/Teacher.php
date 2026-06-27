<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Teacher extends Model
{
    /** @use HasFactory<\Database\Factories\TeacherFactory> */
    use BelongsToAcademicContext, HasFactory;

    // مرتبط بالعام فقط (لا فصل)
    protected bool $usesSemester = false;

    protected $fillable = [
        'academic_year_id', 'school_id', 'department_id', 'coordinator_id', 'stage_id',
        'classification_id', 'name', 'employee_no', 'national_id', 'gender', 'nationality',
        'birth_date', 'job_title', 'academic_degree', 'specialization', 'ministry_hire_date',
        'license_level', 'license_year', 'residential_zone', 'sections_count', 'quota',
        'phone', 'email', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sections_count' => 'integer',
            'quota' => 'integer',
            'birth_date' => 'date',
            'ministry_hire_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    /** المعلمون النشطون فقط (المسنَدون فعليًا لهذه المدرسة في العام). */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    public function coordinator(): BelongsTo
    {
        return $this->belongsTo(Coordinator::class);
    }

    public function classification(): BelongsTo
    {
        return $this->belongsTo(TeacherClassification::class, 'classification_id');
    }

    /** سجلّات التصنيف المرحلية لهذا المعلم في العام المختار. */
    public function classificationRecords(): HasMany
    {
        return $this->hasMany(ClassificationRecord::class);
    }

    // الصفوف التي يدرّسها المعلم (تُدار من شاشة داخل النظام)
    public function grades(): BelongsToMany
    {
        return $this->belongsToMany(Grade::class, 'grade_teacher')->orderBy('grades.sort_order');
    }

    /** كل تكاليف التنسيق لهذا المعلم (تاريخيًا). */
    public function coordinatorAssignments(): HasMany
    {
        return $this->hasMany(CoordinatorAssignment::class);
    }

    /** تكليف التنسيق النشط (إن وُجد) — وجوده يعني أن المعلم منسق حاليًا. */
    public function activeCoordinatorAssignment(): HasOne
    {
        return $this->hasOne(CoordinatorAssignment::class)
            ->where('status', CoordinatorAssignment::STATUS_ACTIVE)
            ->latestOfMany();
    }

    /** هل المعلم منسق حاليًا (يتطلب تحميل activeCoordinatorAssignment). */
    public function getIsCoordinatorAttribute(): bool
    {
        return $this->activeCoordinatorAssignment !== null;
    }

    public function scopeCoordinators($query)
    {
        return $query->whereHas('activeCoordinatorAssignment');
    }
}
