<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class SupervisorPlanItem extends Model
{
    protected $fillable = [
        'supervisor_plan_id', 'school_id', 'visitable_type', 'visitable_id',
        'classification_id', 'planned_visits', 'notes',
    ];

    protected function casts(): array
    {
        return ['planned_visits' => 'integer'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SupervisorPlan::class, 'supervisor_plan_id');
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function visitable(): MorphTo
    {
        return $this->morphTo();
    }

    public function classification(): BelongsTo
    {
        return $this->belongsTo(TeacherClassification::class, 'classification_id');
    }
}
