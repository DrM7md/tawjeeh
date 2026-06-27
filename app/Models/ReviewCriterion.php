<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReviewCriterion extends Model
{
    protected $table = 'review_criteria';

    protected $fillable = ['name', 'max_score', 'sort_order'];

    protected function casts(): array
    {
        return ['max_score' => 'integer', 'sort_order' => 'integer'];
    }
}
