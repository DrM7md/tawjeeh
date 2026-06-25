<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VisitForm extends Model
{
    protected $fillable = [
        'visit_id', 'school_snapshot', 'target_snapshot', 'axes',
        'notes', 'recommendations', 'signature', 'save_status', 'finalized_at',
    ];

    protected function casts(): array
    {
        return [
            'school_snapshot' => 'array',
            'target_snapshot' => 'array',
            'axes' => 'array',
            'finalized_at' => 'datetime',
        ];
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(VisitFile::class);
    }

    public function isFinal(): bool
    {
        return $this->save_status === 'final';
    }
}
