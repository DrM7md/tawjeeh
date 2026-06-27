<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** مجال ضمن قالب الإشراف (يضمّ معايير). */
class VisitDomain extends Model
{
    protected $fillable = ['visit_template_id', 'name', 'sort_order'];

    public function template(): BelongsTo
    {
        return $this->belongsTo(VisitTemplate::class, 'visit_template_id');
    }

    public function standards(): HasMany
    {
        return $this->hasMany(VisitStandard::class)->orderBy('sort_order');
    }
}
