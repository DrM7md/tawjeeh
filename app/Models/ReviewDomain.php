<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** مجال في استمارة تحكيم الاختبارات (يضمّ بنودًا). */
class ReviewDomain extends Model
{
    protected $fillable = ['name', 'kind', 'sort_order'];

    protected $casts = ['sort_order' => 'integer'];

    public function items(): HasMany
    {
        return $this->hasMany(ReviewItem::class)->orderBy('sort_order');
    }
}
