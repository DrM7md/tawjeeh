<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GradeTrack extends Model
{
    protected $fillable = ['grade_id', 'name', 'sort_order'];

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }
}
