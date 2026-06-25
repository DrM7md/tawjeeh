<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TestReview extends Model
{
    use Auditable, BelongsToAcademicContext; // العام + الفصل (TR-1/TR-4)

    protected $fillable = [
        'academic_year_id', 'semester_id', 'supervisor_id', 'school_id',
        'department_id', 'stage_id', 'grade', 'status', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return ['reviewed_at' => 'date'];
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
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

    public function form(): HasOne
    {
        return $this->hasOne(TestReviewForm::class);
    }

    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isSuper() || $user->hasPermission('reviews.view.all')) {
            return $query;
        }
        if ($user->hasPermission('reviews.view.department') && $user->department_id) {
            return $query->where('department_id', $user->department_id);
        }

        return $query->where('supervisor_id', $user->id);
    }
}
