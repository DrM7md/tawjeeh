<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** معيار ضمن مجال (يُقيَّم 0–4 في الزيارة، وله توصيات جاهزة). */
class VisitStandard extends Model
{
    protected $fillable = ['visit_domain_id', 'name', 'sort_order'];

    public function domain(): BelongsTo
    {
        return $this->belongsTo(VisitDomain::class, 'visit_domain_id');
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(VisitStandardRecommendation::class)->orderBy('sort_order');
    }
}
