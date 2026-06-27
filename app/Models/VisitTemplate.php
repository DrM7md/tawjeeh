<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * قالب استمارة إشراف: مجالات ← معايير ← توصيات. مرتبط بأقسام (مواد) يُحمّل لها تلقائيًا.
 */
class VisitTemplate extends Model
{
    protected $fillable = ['name', 'description', 'is_active', 'created_by'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function domains(): HasMany
    {
        return $this->hasMany(VisitDomain::class)->orderBy('sort_order');
    }

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class, 'visit_template_department');
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class, 'template_id');
    }
}
