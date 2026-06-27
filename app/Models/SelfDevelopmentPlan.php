<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * خطة تطوير ذاتي للمعلم/المنسق: أهداف صاحب الخطة + تغذية راجعة من الموجّه.
 * مرتبطة بالعام فقط (لا فصل).
 */
class SelfDevelopmentPlan extends Model
{
    use Auditable, BelongsToAcademicContext;

    // مرتبط بالعام فقط (لا فصل)
    protected bool $usesSemester = false;

    protected $fillable = [
        'academic_year_id', 'target_type', 'target_id', 'school_id', 'supervisor_id',
        'department_id', 'goals', 'supervisor_feedback', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return ['goals' => 'array'];
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

    /** نطاق: يقتصر على ما يخص المستخدم (نفس قواعد خطط التحسين). */
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
