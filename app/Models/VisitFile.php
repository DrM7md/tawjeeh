<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VisitFile extends Model
{
    protected $fillable = ['visit_form_id', 'path', 'original_name', 'mime', 'size'];

    public function form(): BelongsTo
    {
        return $this->belongsTo(VisitForm::class, 'visit_form_id');
    }
}
