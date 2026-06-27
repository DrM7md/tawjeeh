<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** بند ضمن مجال التحكيم (يحمل مؤشّرات وملاحظات). */
class ReviewItem extends Model
{
    protected $fillable = ['review_domain_id', 'name', 'description', 'sort_order'];

    protected $casts = ['sort_order' => 'integer'];

    public function domain(): BelongsTo
    {
        return $this->belongsTo(ReviewDomain::class, 'review_domain_id');
    }

    public function indicators(): HasMany
    {
        return $this->hasMany(ReviewIndicator::class)->orderBy('sort_order');
    }
}
