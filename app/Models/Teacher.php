<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Teacher extends Model
{
    /** @use HasFactory<\Database\Factories\TeacherFactory> */
    use BelongsToAcademicContext, HasFactory;

    // مرتبط بالعام فقط (لا فصل)
    protected bool $usesSemester = false;

    protected $fillable = [
        'academic_year_id', 'school_id', 'department_id', 'coordinator_id', 'stage_id',
        'classification_id', 'name', 'sections_count', 'phone', 'email',
    ];

    protected function casts(): array
    {
        return ['sections_count' => 'integer'];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function coordinator(): BelongsTo
    {
        return $this->belongsTo(Coordinator::class);
    }

    public function classification(): BelongsTo
    {
        return $this->belongsTo(TeacherClassification::class, 'classification_id');
    }
}
