<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * مراجعة دورية على خطة تحسين — سجل تابع للخطة (لا يخضع لفلترة السياق مباشرةً).
 */
class ImprovementReview extends Model
{
    use Auditable;

    protected $fillable = [
        'improvement_plan_id', 'review_date', 'progress_note', 'next_steps', 'created_by',
    ];

    protected function casts(): array
    {
        return ['review_date' => 'date'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(ImprovementPlan::class, 'improvement_plan_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
