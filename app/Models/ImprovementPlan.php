<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * خطة تحسين مشتركة (المدرسة + الموجّه) لمعلم أو منسق، تُتابَع بمراجعات دورية.
 * مرتبطة بالعام فقط (لا فصل) — تستمر المراجعات الشهرية عبر الفصول.
 */
class ImprovementPlan extends Model
{
    use Auditable, BelongsToAcademicContext;

    // مرتبط بالعام فقط (لا فصل)
    protected bool $usesSemester = false;

    protected $fillable = [
        'academic_year_id', 'target_type', 'target_id', 'school_id', 'supervisor_id',
        'department_id', 'title', 'goals', 'status', 'start_date', 'target_date',
        'last_reminded_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'goals' => 'array',
            'start_date' => 'date',
            'target_date' => 'date',
            'last_reminded_at' => 'datetime',
        ];
    }

    public function target(): MorphTo
    {
        return $this->morphTo();
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ImprovementReview::class)->latest('review_date')->latest('id');
    }

    /** نطاق: يقتصر على ما يخص المستخدم (الموجه يرى خططه فقط، رئيس القسم خطط قسمه). */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isSuper() || $user->hasPermission('improvement.view.all')) {
            return $query;
        }

        if ($user->hasPermission('improvement.view.department') && $user->department_id) {
            return $query->where('department_id', $user->department_id);
        }

        return $query->where('supervisor_id', $user->id);
    }
}
