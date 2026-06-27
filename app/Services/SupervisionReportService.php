<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Teacher;
use App\Models\User;
use App\Models\Visit;
use App\Models\VisitFollowup;
use App\Support\ActiveContext;
use App\Support\SupervisionRatings;
use Illuminate\Support\Collection;

/**
 * تقارير الزيارات الإشرافية: تقرير الأقسام، مقارنة المعلمين، أداء المعلم عبر الأعوام.
 * كل النِّسَب تُحتسب من درجات المعايير (0–4) عبر SupervisionRatings::percent.
 */
class SupervisionReportService
{
    public function __construct(
        private readonly ActiveContext $context,
        private readonly VisitService $visits,
    ) {}

    /** الأقسام المتاحة للمستخدم لاختيارها في فلاتر التقارير. */
    public function scopedDepartments(User $user): Collection
    {
        if ($user->isSuper() || $user->hasPermission('visits.view.all') || $user->hasPermission('reports.global')) {
            return Department::orderBy('name')->get(['id', 'name']);
        }

        return Department::when($user->department_id, fn ($q) => $q->where('id', $user->department_id))
            ->orderBy('name')->get(['id', 'name']);
    }

    /* ===================== تقرير الأقسام ===================== */

    /** @return array<string,mixed> */
    public function departmentReport(User $user): array
    {
        $visits = Visit::query()->visibleTo($user)
            ->where('visit_type', 'teacher')
            ->with('department:id,name')
            ->get(['id', 'department_id', 'overall_rating']);

        $rows = $visits->groupBy('department_id')->map(function (Collection $group) {
            $rated = $group->whereNotNull('overall_rating');

            return [
                'id' => $group->first()->department_id,
                'name' => $group->first()->department?->name ?? '—',
                'total_visits' => $group->count(),
                'rated_visits' => $rated->count(),
                'unrated_visits' => $group->count() - $rated->count(),
                'average_rating' => $rated->isNotEmpty() ? round($rated->avg('overall_rating'), 1) : null,
            ];
        })->sortByDesc('average_rating')->values();

        $ratedRows = $rows->whereNotNull('average_rating');

        return [
            'subjects' => $rows->all(),
            'totals' => [
                'total' => $visits->count(),
                'rated' => $visits->whereNotNull('overall_rating')->count(),
                'average' => $ratedRows->isNotEmpty() ? round($ratedRows->avg('average_rating'), 1) : null,
            ],
            'best' => $ratedRows->first(),
            'worst' => $ratedRows->count() > 1 ? $ratedRows->last() : null,
            'academicYear' => $this->context->selectedYear()?->name,
        ];
    }

    /* ===================== مقارنة المعلمين ===================== */

    /** @return array<string,mixed> */
    public function teacherComparison(User $user, int $departmentId): array
    {
        $template = $this->visits->resolveTemplate($departmentId);
        $domains = $this->domainColumns($template);

        $visits = Visit::query()->visibleTo($user)
            ->where('visit_type', 'teacher')->where('department_id', $departmentId)
            ->with(['ratings.standard:id,visit_domain_id', 'supervisor:id,name'])
            ->get();

        // أسماء المعلمين (قد تكون خارج سياق العام عند morphTo) — نجلبها دفعة واحدة
        $teacherNames = Teacher::withoutAcademicContext()
            ->whereIn('id', $visits->pluck('visitable_id')->unique())
            ->pluck('name', 'id');

        $teachers = $visits->groupBy('visitable_id')->map(function (Collection $group, $teacherId) use ($domains, $teacherNames) {
            $perDomain = [];
            foreach ($domains as $d) {
                $vals = $group->map(fn (Visit $v) => $this->domainPercent($v, $d['id']))->filter(fn ($x) => $x !== null);
                $perDomain[$d['id']] = $vals->isNotEmpty() ? round($vals->avg(), 1) : null;
            }
            $overalls = $group->pluck('overall_rating')->filter(fn ($x) => $x !== null);

            return [
                'id' => $teacherId,
                'name' => $teacherNames[$teacherId] ?? '—',
                'visit_count' => $group->count(),
                'visitors' => $group->map(fn ($v) => $v->supervisor?->name)->filter()->unique()->values()->all(),
                'domain_ratings' => $perDomain,
                'overall' => $overalls->isNotEmpty() ? round($overalls->avg(), 1) : null,
            ];
        })->sortByDesc('overall')->values();

        // معدّلات لكل مجال + الإجمالي عبر كل المعلمين
        $domainAverages = [];
        $best = [];
        $worst = [];
        foreach ($domains as $d) {
            $vals = $teachers->pluck("domain_ratings.{$d['id']}")->filter(fn ($x) => $x !== null);
            $domainAverages[$d['id']] = $vals->isNotEmpty() ? round($vals->avg(), 1) : null;
            $ranked = $teachers->filter(fn ($t) => $t['domain_ratings'][$d['id']] !== null)->sortByDesc("domain_ratings.{$d['id']}")->values();
            $best[$d['id']] = $ranked->first()['name'] ?? null;
            $worst[$d['id']] = $ranked->count() > 1 ? $ranked->last()['name'] : null;
        }
        $overallVals = $teachers->pluck('overall')->filter(fn ($x) => $x !== null);

        return [
            'subject_name' => Department::find($departmentId)?->name,
            'domains' => $domains,
            'teachers' => $teachers->all(),
            'domain_averages' => $domainAverages,
            'overall_average' => $overallVals->isNotEmpty() ? round($overallVals->avg(), 1) : null,
            'best' => $best,
            'worst' => $worst,
            'visit_count' => $visits->count(),
            'academicYear' => $this->context->selectedYear()?->name,
        ];
    }

    /* ===================== أداء معلم عبر الأعوام ===================== */

    /** @return array<string,mixed>|null */
    public function teacherPerformance(User $user, int $teacherId): ?array
    {
        $teacher = Teacher::withoutAcademicContext()->find($teacherId);
        if (! $teacher) {
            return null;
        }

        $template = $this->visits->resolveTemplate($teacher->department_id);
        $domains = $this->domainColumns($template);

        $teacherIds = $teacher->national_id
            ? Teacher::withoutAcademicContext()->where('national_id', $teacher->national_id)->pluck('id')
            : collect([$teacher->id]);

        $visits = Visit::withoutAcademicContext()->visibleTo($user)
            ->where('visit_type', 'teacher')->whereIn('visitable_id', $teacherIds)
            ->with(['ratings.standard:id,visit_domain_id', 'supervisor:id,name', 'academicYear:id,name'])
            ->orderBy('visit_date')->orderBy('id')
            ->get();

        $rows = $visits->map(fn (Visit $v) => [
            'id' => $v->id,
            'date' => $v->visit_date?->toDateString(),
            'year' => $v->academicYear?->name,
            'visitor' => $v->supervisor?->name,
            'domain_ratings' => collect($domains)->mapWithKeys(fn ($d) => [$d['id'] => $this->domainPercent($v, $d['id'])])->all(),
            'overall' => $v->overall_rating !== null ? (float) $v->overall_rating : null,
        ])->values();

        $domainAverages = [];
        $improvementDomains = [];
        foreach ($domains as $d) {
            $vals = $rows->pluck("domain_ratings.{$d['id']}")->filter(fn ($x) => $x !== null)->values();
            $domainAverages[$d['id']] = $vals->isNotEmpty() ? round($vals->avg(), 1) : null;
            $improvementDomains[$d['id']] = $vals->count() >= 2 ? round($vals->last() - $vals->first(), 1) : null;
        }
        $overallVals = $rows->pluck('overall')->filter(fn ($x) => $x !== null)->values();

        return [
            'teacher_name' => $teacher->name,
            'subject_name' => Department::find($teacher->department_id)?->name,
            'visit_count' => $visits->count(),
            'date_range' => [
                'from' => optional($visits->first())->visit_date?->toDateString(),
                'to' => optional($visits->last())->visit_date?->toDateString(),
            ],
            'domains' => $domains,
            'visits' => $rows->all(),
            'domain_averages' => $domainAverages,
            'overall_average' => $overallVals->isNotEmpty() ? round($overallVals->avg(), 1) : null,
            'improvement_domains' => $improvementDomains,
            'improvement_overall' => $overallVals->count() >= 2 ? round($overallVals->last() - $overallVals->first(), 1) : null,
        ];
    }

    /** المعلمون ضمن قسم (لفلتر تقرير الأداء). */
    public function teachersInDepartment(User $user, int $departmentId): Collection
    {
        $query = Teacher::where('is_active', true)->where('department_id', $departmentId);

        return $this->visits->applyReportScope($query, $user)->orderBy('name')->get(['id', 'name']);
    }

    /** الموجّهون (الزوّار) الظاهرون في زيارات نطاق المستخدم. */
    public function scopedVisitors(User $user): Collection
    {
        $ids = Visit::query()->visibleTo($user)->distinct()->pluck('supervisor_id');

        return User::whereIn('id', $ids)->orderBy('name')->get(['id', 'name']);
    }

    /* ===================== تغطية الزيارات ===================== */

    /** @return array<string,mixed> */
    public function coverage(User $user, ?int $visitorId = null): array
    {
        $teachers = $this->visits->applyReportScope(
            Teacher::where('is_active', true),
            $user
        )->orderBy('name')->get(['id', 'name']);

        $byTeacher = Visit::query()->visibleTo($user)
            ->where('visit_type', 'teacher')
            ->whereIn('visitable_id', $teachers->pluck('id'))
            ->when($visitorId, fn ($q) => $q->where('supervisor_id', $visitorId))
            ->get(['visitable_id', 'visit_date'])
            ->groupBy('visitable_id');

        $coverage = $teachers->map(function (Teacher $t) use ($byTeacher) {
            $vs = $byTeacher->get($t->id);

            return [
                'name' => $t->name,
                'visited' => (bool) $vs,
                'visits' => $vs?->count() ?? 0,
                'last_visit' => $vs ? optional($vs->max('visit_date'))->toDateString() : null,
            ];
        })->values();

        return [
            'teacherCoverage' => $coverage->all(),
            'visitors' => $this->scopedVisitors($user)->all(),
            'selectedVisitorId' => $visitorId,
            'summary' => [
                'teachersTotal' => $teachers->count(),
                'teachersVisited' => $coverage->where('visited', true)->count(),
            ],
            'activeYear' => $this->context->selectedYear()?->name,
        ];
    }

    /* ===================== متابعة التوصيات ===================== */

    /** @return array<string,mixed> */
    public function recommendationsFollowup(User $user, ?int $teacherId): array
    {
        if (! $teacherId) {
            return ['data' => null, 'followupStatuses' => SupervisionRatings::FOLLOWUP_STATUSES, 'academicYear' => $this->context->selectedYear()?->name];
        }

        $teacher = Teacher::withoutAcademicContext()->find($teacherId);
        if (! $teacher) {
            return ['data' => null, 'followupStatuses' => SupervisionRatings::FOLLOWUP_STATUSES, 'academicYear' => $this->context->selectedYear()?->name];
        }

        $domains = $this->domainColumns($this->visits->resolveTemplate($teacher->department_id));

        $visits = Visit::query()->visibleTo($user)
            ->where('visit_type', 'teacher')->where('visitable_id', $teacherId)
            ->with(['ratings.standard:id,visit_domain_id', 'supervisor:id,name', 'followups', 'form:id,visit_id,general_notes'])
            ->orderBy('visit_date')->get();

        $rows = $visits->map(function (Visit $v) use ($domains) {
            $followups = $v->followups->keyBy('visit_domain_id');
            $domainData = [];
            foreach ($domains as $d) {
                $recs = $v->ratings
                    ->filter(fn ($r) => $r->standard?->visit_domain_id === $d['id'] && filled($r->recommendation))
                    ->pluck('recommendation')->values();
                $domainData[$d['id']] = [
                    'recommendations' => $recs->all(),
                    'followup_status' => $followups->get($d['id'])?->status ?? 'pending',
                ];
            }

            return [
                'id' => $v->id,
                'visit_date' => $v->visit_date?->toDateString(),
                'visitor' => $v->supervisor?->name,
                'visitor_role' => $v->follow_up_type,
                'overall_rating' => $v->overall_rating !== null ? (float) $v->overall_rating : null,
                'domains' => $domainData,
                'general_notes' => $v->form?->general_notes,
            ];
        });

        return [
            'data' => [
                'teacher_name' => $teacher->name,
                'subject_name' => Department::find($teacher->department_id)?->name,
                'domains' => $domains,
                'visits' => $rows->all(),
            ],
            'followupStatuses' => SupervisionRatings::FOLLOWUP_STATUSES,
            'academicYear' => $this->context->selectedYear()?->name,
        ];
    }

    public function saveFollowup(int $visitId, int $domainId, string $status): void
    {
        VisitFollowup::updateOrCreate(
            ['visit_id' => $visitId, 'visit_domain_id' => $domainId],
            ['status' => $status],
        );
    }

    /* ===================== الإحصائيات الشاملة عبر الأعوام ===================== */

    /** @return array<string,mixed> */
    public function crossYearStatistics(User $user): array
    {
        $visits = Visit::withoutAcademicContext()->visibleTo($user)
            ->where('visit_type', 'teacher')
            ->with(['academicYear:id,name', 'department:id,name', 'supervisor:id,name'])
            ->get(['id', 'academic_year_id', 'visitable_id', 'department_id', 'supervisor_id', 'overall_rating', 'visit_date']);

        if ($visits->isEmpty()) {
            return ['yearSummaries' => [], 'ratingDistribution' => [], 'subjectAcrossYears' => [], 'teacherHighlights' => [], 'monthlyDistribution' => [], 'visitorStats' => []];
        }

        $byYear = $visits->groupBy('academic_year_id')->sortKeys();
        $teacherNames = Teacher::withoutAcademicContext()->whereIn('id', $visits->pluck('visitable_id')->unique())->pluck('name', 'id');

        $yearSummaries = $byYear->map(function (Collection $g) {
            $rated = $g->whereNotNull('overall_rating');

            return [
                'year_id' => $g->first()->academic_year_id,
                'year_name' => $g->first()->academicYear?->name ?? '—',
                'total_visits' => $g->count(),
                'avg_rating' => $rated->isNotEmpty() ? round($rated->avg('overall_rating'), 1) : null,
                'teacher_count' => $g->pluck('visitable_id')->unique()->count(),
                'subject_count' => $g->pluck('department_id')->unique()->count(),
                'full_visits' => $rated->count(),
                'partial_visits' => $g->count() - $rated->count(),
            ];
        })->values();

        $ratingDistribution = $byYear->map(function (Collection $g) {
            $b = ['excellent' => 0, 'very_good' => 0, 'good' => 0, 'acceptable' => 0, 'weak' => 0];
            foreach ($g->whereNotNull('overall_rating') as $v) {
                $r = (float) $v->overall_rating;
                $key = $r >= 90 ? 'excellent' : ($r >= 75 ? 'very_good' : ($r >= 60 ? 'good' : ($r >= 50 ? 'acceptable' : 'weak')));
                $b[$key]++;
            }

            return array_merge([
                'year_id' => $g->first()->academic_year_id,
                'year_name' => $g->first()->academicYear?->name ?? '—',
                'total' => $g->whereNotNull('overall_rating')->count(),
            ], $b);
        })->values();

        $monthlyDistribution = $byYear->map(function (Collection $g) {
            $m = array_fill(1, 12, 0);
            foreach ($g as $v) {
                $mm = (int) optional($v->visit_date)->format('n');
                if ($mm) {
                    $m[$mm]++;
                }
            }

            return ['year_id' => $g->first()->academic_year_id, 'year_name' => $g->first()->academicYear?->name ?? '—', 'months' => $m];
        })->values();

        // أداء الأقسام عبر الأعوام
        $deptNames = $visits->pluck('department.name', 'department_id');
        $subjectAcrossYears = $visits->groupBy('department_id')->map(function (Collection $g, $deptId) use ($byYear, $deptNames) {
            $years = [];
            foreach ($byYear as $yearId => $_) {
                $yg = $g->where('academic_year_id', $yearId);
                $rated = $yg->whereNotNull('overall_rating');
                $years[$yearId] = $yg->isNotEmpty()
                    ? ['avg' => $rated->isNotEmpty() ? round($rated->avg('overall_rating'), 1) : null, 'visits' => $yg->count()]
                    : null;
            }

            return ['id' => $deptId, 'name' => $deptNames[$deptId] ?? '—', 'years' => $years];
        })->values();

        // أفضل/أسوأ معلم لكل عام
        $teacherHighlights = $byYear->map(function (Collection $g) use ($teacherNames) {
            $perTeacher = $g->whereNotNull('overall_rating')->groupBy('visitable_id')->map(fn ($tg) => round($tg->avg('overall_rating'), 1));
            if ($perTeacher->isEmpty()) {
                return null;
            }
            $sorted = $perTeacher->sortDesc();

            return [
                'year_id' => $g->first()->academic_year_id,
                'year_name' => $g->first()->academicYear?->name ?? '—',
                'best' => ['name' => $teacherNames[$sorted->keys()->first()] ?? '—', 'avg' => $sorted->first()],
                'worst' => ['name' => $teacherNames[$sorted->keys()->last()] ?? '—', 'avg' => $sorted->last()],
            ];
        })->filter()->values();

        // نشاط الموجّهين لكل عام
        $visitorStats = $byYear->map(function (Collection $g) {
            $visitors = $g->groupBy('supervisor_id')->map(function (Collection $vg) {
                $rated = $vg->whereNotNull('overall_rating');

                return [
                    'name' => $vg->first()->supervisor?->name ?? '—',
                    'role' => '',
                    'visits' => $vg->count(),
                    'avg' => $rated->isNotEmpty() ? round($rated->avg('overall_rating'), 1) : null,
                ];
            })->sortByDesc('visits')->values();

            return ['year_id' => $g->first()->academic_year_id, 'year_name' => $g->first()->academicYear?->name ?? '—', 'visitors' => $visitors->all()];
        })->values();

        return compact('yearSummaries', 'ratingDistribution', 'subjectAcrossYears', 'teacherHighlights', 'monthlyDistribution', 'visitorStats');
    }

    /* ===================== مساعدات ===================== */

    /** @return list<array{id:int,name:string}> */
    private function domainColumns($template): array
    {
        if (! $template) {
            return [];
        }

        return $template->domains->map(fn ($d) => ['id' => $d->id, 'name' => $d->name])->values()->all();
    }

    /** نسبة مجال واحد في زيارة (من درجات معاييره). */
    private function domainPercent(Visit $visit, int $domainId): ?float
    {
        $values = $visit->ratings
            ->filter(fn ($r) => $r->standard?->visit_domain_id === $domainId)
            ->pluck('rating_value')->all();

        return SupervisionRatings::percent($values);
    }
}
