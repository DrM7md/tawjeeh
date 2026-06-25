<?php

namespace App\Models\Scopes;

use App\Support\ActiveContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * يفلتر السجلات تلقائيًا حسب العام (والفصل) المختار في السياق.
 * يُطبَّق عبر Trait BelongsToAcademicContext.
 */
class AcademicContextScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        /** @var ActiveContext $context */
        $context = app(ActiveContext::class);

        $yearId = $context->selectedYearId();
        if ($yearId !== null) {
            $builder->where($model->getTable().'.academic_year_id', $yearId);
        }

        if ($model->usesSemesterContext()) {
            $semesterId = $context->selectedSemesterId();
            if ($semesterId !== null) {
                $builder->where($model->getTable().'.semester_id', $semesterId);
            }
        }
    }
}
