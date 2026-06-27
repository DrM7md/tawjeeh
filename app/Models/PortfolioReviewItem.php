<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * بند ضمن قالب تقييم الملفات: نص المعيار + الدرجة العظمى + الترتيب.
 */
class PortfolioReviewItem extends Model
{
    protected $fillable = ['portfolio_review_template_id', 'criterion_text', 'max_score', 'sort_order'];

    protected function casts(): array
    {
        return ['max_score' => 'integer', 'sort_order' => 'integer'];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(PortfolioReviewTemplate::class, 'portfolio_review_template_id');
    }
}
