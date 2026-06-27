<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** مؤشّر (خيار) ضمن بند تحكيم — يحمل وزنًا خفيًا للإحصاء. */
class ReviewIndicator extends Model
{
    protected $fillable = ['review_item_id', 'label', 'weight', 'sort_order'];

    protected $casts = ['weight' => 'integer', 'sort_order' => 'integer'];

    public function item(): BelongsTo
    {
        return $this->belongsTo(ReviewItem::class, 'review_item_id');
    }
}
