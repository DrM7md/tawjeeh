<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Visit extends Model
{
    use Auditable, BelongsToAcademicContext; // مرتبط بالعام + الفصل

    protected $fillable = [
        'academic_year_id', 'semester_id', 'supervisor_id', 'school_id', 'department_id',
        'visit_type', 'visitable_type', 'visitable_id', 'visit_date', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return ['visit_date' => 'date'];
    }

    public function visitable(): MorphTo
    {
        return $this->morphTo();
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

    public function form(): HasOne
    {
        return $this->hasOne(VisitForm::class);
    }

    /** نطاق: يقتصر على ما يخص المستخدم (الموجه يرى زياراته فقط). */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isSuper() || $user->hasPermission('visits.view.all')) {
            return $query;
        }

        if ($user->hasPermission('visits.view.department') && $user->department_id) {
            return $query->where('department_id', $user->department_id);
        }

        return $query->where('supervisor_id', $user->id);
    }
}
