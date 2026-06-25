<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportBatch extends Model
{
    use BelongsToAcademicContext;

    protected bool $usesSemester = false;

    protected $fillable = [
        'academic_year_id', 'user_id', 'original_filename', 'status',
        'total_rows', 'imported_rows', 'updated_rows', 'failed_rows', 'summary',
    ];

    protected function casts(): array
    {
        return ['summary' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function errors(): HasMany
    {
        return $this->hasMany(ImportError::class);
    }
}
