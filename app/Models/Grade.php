<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Grade extends Model
{
    protected $fillable = ['stage_id', 'name', 'sort_order'];

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    public function tracks(): HasMany
    {
        return $this->hasMany(GradeTrack::class)->orderBy('sort_order');
    }
}
