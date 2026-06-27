<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * مدير المدرسة لعام دراسي محدّد — يُفلتر تلقائيًا بالعام المختار عبر السياق.
 */
class SchoolPrincipal extends Model
{
    use BelongsToAcademicContext;

    // مرتبط بالعام فقط (لا فصل)
    protected bool $usesSemester = false;

    protected $fillable = ['academic_year_id', 'school_id', 'name'];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }
}
