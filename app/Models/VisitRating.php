<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** درجة معيار في زيارة (0 = غير مقيّم، 1..4 مستويات) + توصية اختيارية. */
class VisitRating extends Model
{
    protected $fillable = ['visit_id', 'visit_standard_id', 'rating_value', 'recommendation'];

    protected function casts(): array
    {
        return ['rating_value' => 'integer'];
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    public function standard(): BelongsTo
    {
        return $this->belongsTo(VisitStandard::class, 'visit_standard_id');
    }
}
