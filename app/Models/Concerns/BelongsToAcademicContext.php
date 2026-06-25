<?php

namespace App\Models\Concerns;

use App\Models\AcademicYear;
use App\Models\Scopes\AcademicContextScope;
use App\Models\Semester;
use App\Support\ActiveContext;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * يربط الموديل بالعام (والفصل) الأكاديمي:
 * - فلترة تلقائية حسب السياق المختار (Global Scope).
 * - تعبئة تلقائية لـ academic_year_id / semester_id عند الإنشاء من السياق النشط.
 *
 * الموديلات المرتبطة بالعام فقط (لا فصل) تضبط: protected bool $usesSemester = false;
 *
 * المرجع: Brain/01-ARCHITECTURE.md §5
 */
trait BelongsToAcademicContext
{
    public static function bootBelongsToAcademicContext(): void
    {
        static::addGlobalScope(new AcademicContextScope);

        static::creating(function ($model) {
            /** @var ActiveContext $context */
            $context = app(ActiveContext::class);

            if (empty($model->academic_year_id)) {
                $model->academic_year_id = $context->selectedYearId();
            }

            if ($model->usesSemesterContext() && empty($model->semester_id)) {
                $model->semester_id = $context->selectedSemesterId();
            }
        });
    }

    /** هل يرتبط هذا الموديل بالفصل الدراسي إضافةً للعام؟ */
    public function usesSemesterContext(): bool
    {
        return property_exists($this, 'usesSemester') ? $this->usesSemester : true;
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function semester(): BelongsTo
    {
        return $this->belongsTo(Semester::class);
    }

    /** استعلام بدون فلترة السياق (لكل الأعوام). */
    public static function withoutAcademicContext(): \Illuminate\Database\Eloquent\Builder
    {
        return static::withoutGlobalScope(AcademicContextScope::class);
    }
}
