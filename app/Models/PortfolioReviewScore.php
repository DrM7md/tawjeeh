<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * درجة بند واحد ضمن تقييم ملفات المنسق: الدرجة + ملاحظة + مرفق (دليل).
 * نص البند ودرجته العظمى محفوظان لقطةً كي لا يتأثر السجل بتعديل القالب لاحقًا.
 */
class PortfolioReviewScore extends Model
{
    protected $fillable = [
        'portfolio_review_id', 'portfolio_review_item_id', 'criterion_text', 'indicators',
        'max_score', 'score', 'note', 'attachment_path', 'attachment_name', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['max_score' => 'integer', 'score' => 'integer', 'sort_order' => 'integer'];
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(PortfolioReview::class, 'portfolio_review_id');
    }
}
