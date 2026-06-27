<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** توصية جاهزة مقترحة لمعيار (تُدرَج بضغطة في الاستمارة). */
class VisitStandardRecommendation extends Model
{
    protected $fillable = ['visit_standard_id', 'text', 'sort_order'];

    public function standard(): BelongsTo
    {
        return $this->belongsTo(VisitStandard::class, 'visit_standard_id');
    }
}
