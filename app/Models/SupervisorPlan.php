<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupervisorPlan extends Model
{
    use Auditable, BelongsToAcademicContext; // مرتبط بالعام فقط (لا فصل)

    // الخطة سنويّة — لا ترتبط بفصل دراسي
    protected bool $usesSemester = false;

    protected $fillable = [
        'academic_year_id', 'department_id', 'supervisor_id', 'status',
        'submitted_at', 'reviewed_at', 'reviewed_by', 'review_notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(SupervisorPlanItem::class);
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    /** هل الخطة قابلة للتعديل من الموجّه؟ (مسودة أو مُرجَعة) */
    public function isEditable(): bool
    {
        return in_array($this->status, ['draft', 'rejected'], true);
    }
}
