<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestReviewForm extends Model
{
    protected $fillable = ['test_review_id', 'criteria', 'total_score', 'notes', 'result'];

    protected function casts(): array
    {
        return ['criteria' => 'array', 'total_score' => 'decimal:2'];
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(TestReview::class, 'test_review_id');
    }
}
