<?php

namespace App\Services;

use App\Models\School;
use App\Models\Teacher;
use App\Models\Visit;
use Illuminate\Support\Collection;

/**
 * يجمّع الملف الشخصي للمعلم عبر الأعوام:
 * - يربط سجلات المعلم المتعدّدة (سجل لكل عام) بالرقم الشخصي.
 * - يجمع كل زياراته (لكل المُوجِّهين) ويحسب «المستوى» من متوسط محاور الاستمارة (1–5).
 * - يجمّع الزيارات حسب العام مع متوسط مستوى لكل عام لرصد التطوّر.
 */
class TeacherProfileService
{
    /** @return array<string,mixed> */
    public function props(School $school, Teacher $teacher): array
    {
        // كل سجلات نفس الشخص عبر الأعوام (ربط بالرقم الشخصي، وإلا هذا السجل فقط).
        $teacherIds = $teacher->national_id
            ? Teacher::withoutAcademicContext()
                ->where('national_id', $teacher->national_id)
                ->pluck('id')
            : collect([$teacher->id]);

        $visits = Visit::withoutAcademicContext()
            ->where('visitable_type', Teacher::class)
            ->whereIn('visitable_id', $teacherIds)
            ->with([
                'supervisor:id,name',
                'academicYear:id,name,is_active',
                'semester:id,name',
                'school:id,name',
                'form:id,visit_id,axes,save_status',
            ])
            ->orderByDesc('visit_date')
            ->orderByDesc('id')
            ->get();

        $years = $this->groupByYear($visits);

        $levels = $years->pluck('average')->filter(fn ($v) => $v !== null);

        return [
            'school' => $school->only(['id', 'name']),
            'teacher' => $this->teacherPayload($teacher),
            'years' => $years->values()->all(),
            'overall' => [
                'total_visits' => $visits->count(),
                'years_count' => $years->count(),
                'average' => $levels->isNotEmpty() ? round($levels->avg(), 1) : null,
                'last_visit' => optional($visits->first())->visit_date?->toDateString(),
            ],
            'defaultAxes' => \App\Http\Controllers\VisitController::AXES,
        ];
    }

    /**
     * @param  Collection<int,Visit>  $visits
     * @return Collection<int,array<string,mixed>>
     */
    private function groupByYear(Collection $visits): Collection
    {
        return $visits
            ->groupBy('academic_year_id')
            ->map(function (Collection $group) {
                $rows = $group->map(fn (Visit $v) => $this->visitRow($v));
                $yearLevels = $rows->pluck('level')->filter(fn ($l) => $l !== null);
                $year = $group->first()->academicYear;

                return [
                    'year_id' => $year?->id,
                    'year_name' => $year?->name ?? '—',
                    'is_active' => (bool) ($year?->is_active),
                    'visits_count' => $group->count(),
                    'average' => $yearLevels->isNotEmpty() ? round($yearLevels->avg(), 1) : null,
                    'visits' => $rows->values()->all(),
                ];
            })
            // الأحدث أولًا (السجلات مرتّبة تنازليًا أصلًا فأوّل زيارة بكل عام تمثّل ترتيبه).
            ->sortByDesc(fn ($y, $yearId) => $visits->firstWhere('academic_year_id', $yearId)?->visit_date)
            ->values();
    }

    /** @return array<string,mixed> */
    private function visitRow(Visit $v): array
    {
        $axes = $v->form?->axes ?? null;

        return [
            'id' => $v->id,
            'date' => $v->visit_date?->toDateString(),
            'semester' => $v->semester?->name,
            'supervisor' => $v->supervisor?->name ?? '—',
            'visit_type' => $v->visit_type,
            'status' => $v->form?->save_status, // draft | final | null (لا استمارة)
            'level' => $this->axesAverage($axes),
            'axes' => $axes ?: null,
        ];
    }

    /** متوسط درجات المحاور المقيّمة (>0). يعيد null إن لم تُقيَّم. */
    private function axesAverage(?array $axes): ?float
    {
        if (! $axes) {
            return null;
        }

        $scored = array_filter(array_map('intval', $axes), fn ($n) => $n > 0);

        return $scored ? round(array_sum($scored) / count($scored), 1) : null;
    }

    /** @return array<string,mixed> */
    private function teacherPayload(Teacher $teacher): array
    {
        $teacher->loadMissing([
            'classification:id,name', 'department:id,name', 'stage:id,name',
            'grades:id,name', 'activeCoordinatorAssignment',
        ]);

        $coordination = $teacher->activeCoordinatorAssignment;

        return [
            'id' => $teacher->id,
            'name' => $teacher->name,
            'national_id' => $teacher->national_id,
            'employee_no' => $teacher->employee_no,
            'gender' => $teacher->gender,
            'nationality' => $teacher->nationality,
            'birth_date' => $teacher->birth_date?->toDateString(),
            'job_title' => $teacher->job_title,
            'academic_degree' => $teacher->academic_degree,
            'specialization' => $teacher->specialization,
            'ministry_hire_date' => $teacher->ministry_hire_date?->toDateString(),
            'license_level' => $teacher->license_level,
            'license_year' => $teacher->license_year,
            'residential_zone' => $teacher->residential_zone,
            'sections_count' => $teacher->sections_count,
            'quota' => $teacher->quota,
            'phone' => $teacher->phone,
            'email' => $teacher->email,
            'is_active' => $teacher->is_active,
            'stage' => $teacher->stage?->name,
            'department' => $teacher->department?->name,
            'classification' => $teacher->classification?->name,
            'grades' => $teacher->grades->map->only(['id', 'name'])->all(),
            'coordination' => $coordination ? [
                'since' => $coordination->start_date?->toDateString(),
                'tenure' => $coordination->tenureLabel(),
            ] : null,
        ];
    }
}
