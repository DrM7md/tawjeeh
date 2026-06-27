<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestReviewFile extends Model
{
    protected $fillable = ['test_review_id', 'path', 'original_name', 'mime', 'size'];

    public function review(): BelongsTo
    {
        return $this->belongsTo(TestReview::class, 'test_review_id');
    }
}
