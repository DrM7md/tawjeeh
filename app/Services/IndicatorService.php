<?php

namespace App\Services;

use App\Models\CalendarTask;
use App\Models\Coordinator;
use App\Models\Department;
use App\Models\School;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\TestReview;
use App\Models\User;
use App\Models\Visit;
use App\Support\ActiveContext;
use App\Support\Permissions;

/**
 * حساب المؤشرات ولوحات التحكم حسب الدور والعام/الفصل المختار.
 * القواعد: IND في Brain/05-BUSINESS-RULES.md.
 */
class IndicatorService
{
    public function __construct(
        private readonly VisitService $visits,
        private readonly ActiveContext $context,
    ) {}

    /** يبني لوحة التحكم المناسبة لدور المستخدم. */
    public function dashboard(User $user): array
    {
        if ($user->isSuper() || $user->isLevel(1)) {
            return ['scope' => 'global', ...$this->global($user)];
        }

        if ($user->isLevel(2) && $user->department_id) {
            return ['scope' => 'department', ...$this->department($user->department_id)];
        }

        return ['scope' => 'supervisor', ...$this->supervisor($user)];
    }

    /* ===================== رئيس التوجيه (شامل) ===================== */
    private function global(User $user): array
    {
        $admin = User::query()->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_HEAD))->first();

        $departments = Department::orderBy('name')->get(['id', 'name']);
        $departmentPerformance = $departments->map(function ($d) use ($admin) {
            $stats = $this->visits->followUp($admin, $d->id)['stats'];

            return [
                'department' => $d->name,
                'completion' => $stats['completion'],
                'done' => $stats['done'],
                'remaining' => $stats['remaining'] + $stats['late'],
                'reviews' => TestReview::where('department_id', $d->id)->count(),
            ];
        });

        $supervisorComparison = $this->supervisorComparison();

        $overall = $this->visits->followUp($admin)['stats'];

        return [
            'cards' => [
                'departments' => $departments->count(),
                'schools' => School::where('is_active', true)->count(),
                'supervisors' => User::whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR))->count(),
                'teachers' => Teacher::where('is_active', true)->count(),
                'coordinators' => Coordinator::count(),
                'completion' => $overall['completion'],
                'visits_done' => Visit::count(),
                'reviews' => TestReview::count(),
            ],
            'departmentPerformance' => $departmentPerformance,
            'statusDistribution' => [
                ['name' => 'تمت', 'value' => $overall['done']],
                ['name' => 'متبقٍ', 'value' => $overall['remaining']],
                ['name' => 'متأخر', 'value' => $overall['late']],
            ],
            'attention' => $this->attention($overall, $supervisorComparison),
            'trend' => $this->completionTrend($overall['total']),
            'reviewsSummary' => $this->reviewsSummary(),
            'upcomingTasks' => $this->upcomingTasks($user),
        ];
    }

    /**
     * «تحتاج انتباهك»: مؤشرات التدخّل السريع — متأخرات، تحكيمات متبقية،
     * مدارس بلا زيارة، والموجّهون الأكثر تعثّرًا.
     *
     * @param  array<string,mixed>  $overall
     * @param  list<array<string,mixed>>  $supervisorComparison
     * @return array<string,mixed>
     */
    private function attention(array $overall, array $supervisorComparison): array
    {
        $rows = collect($supervisorComparison);
        $reviewsPending = max(0, (int) $rows->sum('reviews_total') - (int) $rows->sum('reviews_done'));

        $lagging = $rows
            ->filter(fn ($r) => $r['schools'] > 0 && $r['overall'] < 100)
            ->sortBy('overall')
            ->take(5)
            ->map(fn ($r) => ['name' => $r['supervisor'], 'overall' => $r['overall'], 'schools' => $r['schools']])
            ->values()->all();

        $yearId = $this->context->selectedYearId();
        $visitedSchoolIds = $yearId
            ? Visit::withoutAcademicContext()->where('academic_year_id', $yearId)->distinct()->pluck('school_id')
            : collect();
        $noVisitSchools = School::where('is_active', true)->whereNotIn('id', $visitedSchoolIds)->orderBy('name')->pluck('name');

        return [
            'late_visits' => $overall['late'],
            'reviews_pending' => $reviewsPending,
            'schools_no_visits' => $noVisitSchools->count(),
            'lagging_supervisors' => $lagging,
            'schools_without_visits' => $noVisitSchools->take(6)->values()->all(),
        ];
    }

    /**
     * منحنى الإنجاز عبر أسابيع الفصل المختار: الزيارات المنجزة التراكمية مقابل المسار المثالي.
     *
     * @return list<array<string,mixed>>
     */
    private function completionTrend(int $target): array
    {
        $semester = $this->context->selectedSemester();
        if (! $semester || ! $semester->start_date || ! $semester->end_date) {
            return [];
        }

        $start = $semester->start_date->copy()->startOfDay();
        $end = $semester->end_date->copy()->endOfDay();
        $weeks = max(1, (int) ceil($start->diffInDays($end) / 7));

        // عدد الزيارات لكل أسبوع ضمن نافذة الفصل (Visit مقصور تلقائيًا على الفصل المختار).
        $perWeek = array_fill(0, $weeks, 0);
        foreach (Visit::whereBetween('visit_date', [$start, $end])->pluck('visit_date') as $date) {
            $idx = min($weeks - 1, intdiv((int) $start->diffInDays($date), 7));
            $perWeek[$idx]++;
        }

        $now = now();
        if ($now->lt($start)) {
            $currentWeek = -1;
        } elseif ($now->gt($end)) {
            $currentWeek = $weeks - 1;
        } else {
            $currentWeek = intdiv((int) $start->diffInDays($now), 7);
        }

        $cumulative = 0;
        $trend = [];
        for ($i = 0; $i < $weeks; $i++) {
            $cumulative += $perWeek[$i];
            $trend[] = [
                'name' => 'أسبوع '.($i + 1),
                'done' => $i <= $currentWeek ? $cumulative : null,
                'target' => (int) round($target * ($i + 1) / $weeks),
            ];
        }

        return $trend;
    }

    /**
     * ملخّص التحكيم: نسبة الإنجاز الكلية وتفصيلها حسب فترات الاختبار الأربع
     * (لكل مدرسة مُسندة اختبار واحد في كل فترة).
     *
     * @return array<string,mixed>
     */
    private function reviewsSummary(): array
    {
        $assignedSchoolIds = SchoolAssignment::pluck('school_id')->unique();
        $schoolsCount = $assignedSchoolIds->count();

        $finalByPeriod = TestReview::where('status', 'final')
            ->whereNotNull('exam_period')
            ->whereIn('school_id', $assignedSchoolIds)
            ->get(['school_id', 'exam_period'])
            ->unique(fn ($r) => $r->school_id.'-'.$r->exam_period)
            ->groupBy('exam_period');

        $periods = collect(TestReviewService::EXAM_PERIODS)->map(fn ($p) => [
            'period' => $p,
            'done' => ($finalByPeriod->get($p)?->count()) ?? 0,
            'total' => $schoolsCount,
        ])->all();

        $done = collect($periods)->sum('done');
        $total = $schoolsCount * count(TestReviewService::EXAM_PERIODS);

        return [
            'completion' => $total ? round($done / $total * 100, 1) : 0,
            'done' => $done,
            'total' => $total,
            'periods' => $periods,
        ];
    }

    /**
     * مهام التقويم القادمة للمستخدم (ما أنشأه أو أُسند إليه) خلال أسبوعين.
     *
     * @return list<array<string,mixed>>
     */
    private function upcomingTasks(User $user): array
    {
        $today = now()->startOfDay();
        $horizon = now()->copy()->addDays(14)->endOfDay();

        return CalendarTask::query()
            ->with('eventType:id,name,color')
            ->where(fn ($q) => $q
                ->where('creator_id', $user->id)
                ->orWhereHas('assignees', fn ($a) => $a->where('user_id', $user->id)))
            ->whereNotNull('start_date')
            ->whereDate('start_date', '>=', $today)
            ->whereDate('start_date', '<=', $horizon)
            ->withCount(['assignees', 'assignees as done_count' => fn ($q) => $q->where('status', 'done')])
            ->orderBy('start_date')->orderBy('start_time')
            ->limit(6)->get()
            ->map(fn (CalendarTask $t) => [
                'id' => $t->id,
                'title' => $t->title,
                'priority' => $t->priority,
                'color' => $t->color,
                'location' => $t->location,
                'start_date' => $t->start_date?->toDateString(),
                'due_date' => $t->due_date?->toDateString(),
                'event_type' => $t->eventType ? ['name' => $t->eventType->name, 'color' => $t->eventType->color] : null,
                'done_count' => (int) $t->done_count,
                'total_count' => (int) $t->assignees_count,
            ])->all();
    }

    /* ===================== رئيس القسم ===================== */
    private function department(int $departmentId): array
    {
        $admin = User::query()->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_HEAD))->first();
        $stats = $this->visits->followUp($admin, $departmentId)['stats'];

        $assignedSchoolIds = SchoolAssignment::where('department_id', $departmentId)->pluck('school_id')->unique();

        return [
            'department' => Department::find($departmentId)?->name,
            'cards' => [
                'schools' => $assignedSchoolIds->count(),
                'teachers' => Teacher::where('department_id', $departmentId)->where('is_active', true)->count(),
                'coordinators' => Coordinator::where('department_id', $departmentId)->count(),
                'completion' => $stats['completion'],
                'visits_done' => $stats['done'],
                'reviews' => TestReview::where('department_id', $departmentId)->count(),
                'incomplete' => $stats['remaining'] + $stats['late'],
            ],
            'supervisorComparison' => $this->supervisorComparison($departmentId),
            'statusDistribution' => [
                ['name' => 'تمت', 'value' => $stats['done']],
                ['name' => 'متبقٍ', 'value' => $stats['remaining']],
                ['name' => 'متأخر', 'value' => $stats['late']],
            ],
        ];
    }

    /* ===================== الموجه ===================== */
    private function supervisor(User $user): array
    {
        $stats = $this->visits->followUp($user)['stats'];
        $schoolIds = SchoolAssignment::where('supervisor_id', $user->id)->pluck('school_id');

        return [
            'cards' => [
                'schools' => $schoolIds->count(),
                'completion' => $stats['completion'],
                'visits_done' => $stats['done'],
                'remaining' => $stats['remaining'] + $stats['late'],
                'reviews' => TestReview::where('supervisor_id', $user->id)->count(),
            ],
            'statusDistribution' => [
                ['name' => 'تمت', 'value' => $stats['done']],
                ['name' => 'متبقٍ', 'value' => $stats['remaining']],
                ['name' => 'متأخر', 'value' => $stats['late']],
            ],
        ];
    }

    /**
     * مقارنة الموجهين: نسبة إنجاز الزيارات + نسبة إنجاز التحكيم لكل موجّه،
     * مرتّبة تنازليًا (الأكثر تقدّمًا أولًا) لإبراز المتعثّرين في الأسفل.
     */
    private function supervisorComparison(?int $departmentId = null): array
    {
        $query = User::with('roles')->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR));
        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }

        return $query->orderBy('name')->get()->map(function ($s) use ($departmentId) {
            // الزيارات: followUp يقصر النطاق على مدارس الموجّه ويعيد نسبة الإنجاز.
            $v = $this->visits->followUp($s)['stats'];

            // التحكيم: كل مدرسة مكلّف بها عليها 4 اختبارات (exam_period).
            $assignedSchoolIds = SchoolAssignment::where('supervisor_id', $s->id)
                ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId))
                ->pluck('school_id')->unique();

            $reviewsTotal = $assignedSchoolIds->count() * 4;
            $reviewsDone = TestReview::where('supervisor_id', $s->id)
                ->whereIn('school_id', $assignedSchoolIds)
                ->where('status', 'final')
                ->whereNotNull('exam_period')
                ->get(['school_id', 'exam_period'])
                ->unique(fn ($r) => $r->school_id.'-'.$r->exam_period)
                ->count();
            $reviewsPct = $reviewsTotal ? round($reviewsDone / $reviewsTotal * 100, 1) : 0;

            return [
                'supervisor' => $s->name,
                'schools' => $assignedSchoolIds->count(),
                'visits_pct' => $v['completion'],
                'visits_done' => $v['done'],
                'visits_total' => $v['total'],
                'reviews_pct' => $reviewsPct,
                'reviews_done' => $reviewsDone,
                'reviews_total' => $reviewsTotal,
                'overall' => round(($v['completion'] + $reviewsPct) / 2, 1),
            ];
        })->sortByDesc('overall')->values()->all();
    }
}
