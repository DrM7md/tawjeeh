<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SchoolAssignment extends Model
{
    use Auditable, BelongsToAcademicContext;

    // التوزيع مرتبط بالعام فقط (لا فصل) — DS
    protected bool $usesSemester = false;

    protected $fillable = [
        'academic_year_id', 'school_id', 'supervisor_id', 'department_id',
        'assignment_method', 'assigned_by', 'notes',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
