<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * قالب تقييم ملفات المنسق: قائمة بنود/معايير قابلة للضبط بالكامل من الإعدادات.
 */
class PortfolioReviewTemplate extends Model
{
    protected $fillable = ['name', 'description', 'is_active', 'created_by'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PortfolioReviewItem::class)->orderBy('sort_order');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(PortfolioReview::class);
    }
}
