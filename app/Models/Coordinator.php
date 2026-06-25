<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coordinator extends Model
{
    /** @use HasFactory<\Database\Factories\CoordinatorFactory> */
    use BelongsToAcademicContext, HasFactory;

    // مرتبط بالعام فقط (لا فصل)
    protected bool $usesSemester = false;

    protected $fillable = [
        'academic_year_id', 'school_id', 'department_id', 'stage_id', 'name', 'phone', 'email',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function teachers(): HasMany
    {
        return $this->hasMany(Teacher::class);
    }
}
