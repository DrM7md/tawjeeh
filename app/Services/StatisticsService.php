<?php

namespace App\Services;

use App\Models\Coordinator;
use App\Models\School;
use App\Models\SchoolAssignment;
use App\Models\Stage;
use App\Models\Teacher;
use App\Models\TestReview;
use App\Models\User;
use App\Models\Visit;
use App\Support\Permissions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * يبني الإحصائيات التفصيلية لشاشات «الإحصائيات» (المدارس/المستخدمون/الزيارات/التحكيمات).
 * كل البيانات المرتبطة بالعام/الفصل مفلترة تلقائيًا عبر سياق العام المختار (AcademicContextScope).
 */
class StatisticsService
{
    private const GENDER = ['boys' => 'بنين', 'girls' => 'بنات', 'mixed' => 'مشترك'];

    private const MONTHS = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    /* ===================== المدارس ===================== */
    public function schools(): array
    {
        $stages = Stage::orderBy('sort_order')->get(['id', 'name']);
        $schools = School::with('stage:id,name')->get();

        $teachers = Teacher::where('is_active', true)->with('classification:id,name')->get(['id', 'school_id', 'stage_id', 'gender', 'nationality', 'classification_id']);
        $coordBySchool = Coordinator::selectRaw('school_id, COUNT(*) c')->groupBy('school_id')->pluck('c', 'school_id');
        $teacherBySchool = $teachers->groupBy('school_id')->map->count();
        $visitsBySchool = Visit::selectRaw('school_id, COUNT(*) c')->groupBy('school_id')->pluck('c', 'school_id');
        $assignedIds = SchoolAssignment::pluck('school_id')->unique();

        $total = $schools->count();
        $active = $schools->where('is_active', true)->count();
        $teachersByStage = $teachers->groupBy('stage_id')->map->count();
        $schoolsByStage = $schools->groupBy('stage_id')->map->count();

        // توزيع حسب المرحلة (مدارس + معلمون في رسم واحد)
        $byStage = $stages->map(fn ($s) => [
            'name' => $s->name,
            'schools' => $schoolsByStage[$s->id] ?? 0,
            'teachers' => $teachersByStage[$s->id] ?? 0,
        ])->filter(fn ($r) => $r['schools'] > 0 || $r['teachers'] > 0)->values()->all();

        // جدول أكبر المدارس (حسب عدد المعلمين)
        $topSchools = $schools->map(fn ($s) => [
            'name' => $s->name,
            'stage' => $s->stage?->name ?? '—',
            'gender' => self::GENDER[$s->gender] ?? '—',
            'teachers' => $teacherBySchool[$s->id] ?? 0,
            'coordinators' => $coordBySchool[$s->id] ?? 0,
            'visits' => $visitsBySchool[$s->id] ?? 0,
            'assigned' => $assignedIds->contains($s->id),
        ])->sortByDesc('teachers')->take(12)->values()->all();

        return [
            'kpis' => [
                'total' => $total,
                'active' => $active,
                'inactive' => $total - $active,
                'teachers' => $teachers->count(),
                'coordinators' => (int) $coordBySchool->sum(),
                'avgTeachers' => $total ? round($teachers->count() / $total, 1) : 0,
                'assigned' => $assignedIds->count(),
                'unassigned' => $total - $assignedIds->count(),
            ],
            'byStage' => $byStage,
            'byGender' => $this->named($schools->groupBy(fn ($s) => self::GENDER[$s->gender] ?? 'غير محدد')->map->count()),
            'byZone' => $this->topNamed($schools->groupBy(fn ($s) => $s->zone ?: 'غير محددة')->map->count(), 8),
            'coverage' => [
                ['name' => 'مُغطّاة بموجّه', 'value' => $assignedIds->count()],
                ['name' => 'بدون تغطية', 'value' => max(0, $total - $assignedIds->count())],
            ],
            'teacherGender' => $this->named($teachers->groupBy(fn ($t) => match ($t->gender) {
                'male' => 'ذكور', 'female' => 'إناث', default => 'غير محدد',
            })->map->count()),
            'teacherClassification' => $this->topNamed($teachers->groupBy(fn ($t) => $t->classification?->name ?? 'غير مصنّف')->map->count(), 8),
            'teacherNationality' => $this->topNamed($teachers->groupBy(fn ($t) => $t->nationality ?: 'غير محددة')->map->count(), 6),
            'topSchools' => $topSchools,
        ];
    }

    /* ===================== المستخدمون / الموجهون ===================== */
    public function users(User $viewer): array
    {
        $viewAll = $viewer->isSuper() || $viewer->hasRole(Permissions::ROLE_ASSISTANT);

        $users = User::query()
            ->with(['department:id,name', 'roles:id,name,display_name,level'])
            ->when(! $viewAll, fn ($q) => $q->where('department_id', $viewer->department_id))
            ->get();

        $total = $users->count();
        $active = $users->where('is_active', true)->count();

        // أداء الموجهين: الزيارات + التحكيمات + المدارس المسندة (ضمن السياق المختار)
        $supervisorIds = $users->filter(fn ($u) => $u->roles->contains('name', Permissions::ROLE_SUPERVISOR))->pluck('id');
        $visitsBy = Visit::whereIn('supervisor_id', $supervisorIds)->selectRaw('supervisor_id, COUNT(*) c')->groupBy('supervisor_id')->pluck('c', 'supervisor_id');
        $reviewsBy = TestReview::whereIn('supervisor_id', $supervisorIds)->selectRaw('supervisor_id, COUNT(*) c')->groupBy('supervisor_id')->pluck('c', 'supervisor_id');
        $schoolsBy = SchoolAssignment::whereIn('supervisor_id', $supervisorIds)->selectRaw('supervisor_id, COUNT(*) c')->groupBy('supervisor_id')->pluck('c', 'supervisor_id');

        $performance = $users->filter(fn ($u) => $supervisorIds->contains($u->id))->map(fn ($u) => [
            'name' => $u->name,
            'department' => $u->department?->name ?? '—',
            'schools' => (int) ($schoolsBy[$u->id] ?? 0),
            'visits' => (int) ($visitsBy[$u->id] ?? 0),
            'reviews' => (int) ($reviewsBy[$u->id] ?? 0),
        ])->sortByDesc('visits')->values();

        return [
            'kpis' => [
                'total' => $total,
                'active' => $active,
                'inactive' => $total - $active,
                'supervisors' => $supervisorIds->count(),
                'departmentHeads' => $users->filter(fn ($u) => $u->roles->contains('name', Permissions::ROLE_DEPARTMENT_HEAD))->count(),
                'unassigned' => $users->whereNull('department_id')->count(),
                'avgVisits' => $supervisorIds->count() ? round($visitsBy->sum() / $supervisorIds->count(), 1) : 0,
                'avgSchools' => $supervisorIds->count() ? round($schoolsBy->sum() / $supervisorIds->count(), 1) : 0,
            ],
            'byDepartment' => $this->named($users->groupBy(fn ($u) => $u->department?->name ?? 'بدون قسم')->map->count()),
            'byRole' => $this->named($users->groupBy(fn ($u) => $u->roles->sortBy('level')->first()?->display_name ?? 'بدون دور')->map->count()),
            'activeStatus' => [
                ['name' => 'نشط', 'value' => $active],
                ['name' => 'معطّل', 'value' => $total - $active],
            ],
            'performance' => $performance->all(),
            'topPerformers' => $performance->take(10)->all(),
        ];
    }

    /* ===================== الزيارات ===================== */
    public function visits(User $user): array
    {
        $visits = Visit::query()->visibleTo($user)
            ->with(['school:id,name', 'supervisor:id,name', 'department:id,name', 'form:id,visit_id,save_status'])
            ->get();

        $withForm = $visits->filter(fn ($v) => $v->form);

        return [
            'kpis' => [
                'total' => $visits->count(),
                'teacher' => $visits->where('visit_type', 'teacher')->count(),
                'coordinator' => $visits->where('visit_type', 'coordinator')->count(),
                'schools' => $visits->pluck('school_id')->unique()->count(),
                'supervisors' => $visits->pluck('supervisor_id')->unique()->count(),
                'finalized' => $withForm->where('form.save_status', 'final')->count(),
                'draft' => $withForm->where('form.save_status', 'draft')->count(),
            ],
            'byMonth' => $this->byMonth($visits, 'visit_date'),
            'byType' => [
                ['name' => 'معلمون', 'value' => $visits->where('visit_type', 'teacher')->count()],
                ['name' => 'منسقون', 'value' => $visits->where('visit_type', 'coordinator')->count()],
            ],
            'byDepartment' => $this->named($visits->groupBy(fn ($v) => $v->department?->name ?? 'بدون قسم')->map->count()),
            'bySupervisor' => $this->topNamed($visits->groupBy(fn ($v) => $v->supervisor?->name ?? '—')->map->count(), 10),
            'bySchool' => $this->topNamed($visits->groupBy(fn ($v) => $v->school?->name ?? '—')->map->count(), 10),
            'formStatus' => [
                ['name' => 'معتمدة', 'value' => $withForm->where('form.save_status', 'final')->count()],
                ['name' => 'مسودة', 'value' => $withForm->where('form.save_status', 'draft')->count()],
                ['name' => 'بدون استمارة', 'value' => $visits->count() - $withForm->count()],
            ],
        ];
    }

    /* ===================== التحكيمات ===================== */
    public function reviews(User $user): array
    {
        $reviews = TestReview::query()->visibleTo($user)
            ->with(['school:id,name', 'department:id,name', 'stage:id,name', 'grade:id,name', 'supervisor:id,name', 'form:id,test_review_id,total_score'])
            ->get();

        $scores = $reviews->map(fn ($r) => $r->form?->total_score)->filter(fn ($v) => $v !== null)->map(fn ($v) => (float) $v);
        $final = $reviews->where('status', 'final')->count();
        $total = $reviews->count();

        // متوسط الدرجة لكل مادة (قسم)
        $avgByDept = $reviews->filter(fn ($r) => $r->form?->total_score !== null)
            ->groupBy(fn ($r) => $r->department?->name ?? 'بدون مادة')
            ->map(fn ($g) => round($g->avg(fn ($r) => (float) $r->form->total_score), 1))
            ->map(fn ($value, $name) => ['name' => (string) $name, 'value' => $value])
            ->sortByDesc('value')->values()->all();

        // التحكيمات حسب الاختبار (الأربعة بالترتيب الزمني)
        $examLabels = ['mid_first' => 'منتصف الأول', 'final_first' => 'نهاية الأول', 'mid_second' => 'منتصف الثاني', 'final_second' => 'نهاية الثاني'];
        $byExam = collect($examLabels)->map(fn ($label, $key) => [
            'name' => $label,
            'value' => $reviews->where('exam_period', $key)->count(),
        ])->values()->all();

        return [
            'kpis' => [
                'total' => $total,
                'final' => $final,
                'draft' => $total - $final,
                'finalizedPct' => $total ? round($final / $total * 100, 1) : 0,
                'avgScore' => $scores->count() ? round($scores->avg(), 1) : 0,
                'maxScore' => $scores->count() ? round($scores->max(), 1) : 0,
                'schools' => $reviews->pluck('school_id')->unique()->count(),
            ],
            'byMonth' => $this->byMonth($reviews, 'reviewed_at'),
            'byStatus' => [
                ['name' => 'معتمد', 'value' => $final],
                ['name' => 'مسودة', 'value' => $total - $final],
            ],
            'byExam' => $byExam,
            'byDepartment' => $this->named($reviews->groupBy(fn ($r) => $r->department?->name ?? 'بدون مادة')->map->count()),
            'byStage' => $this->named($reviews->groupBy(fn ($r) => $r->stage?->name ?? 'غير محددة')->map->count()),
            'byGrade' => $this->topNamed($reviews->groupBy(fn ($r) => $r->grade?->name ?? 'غير محدد')->map->count(), 8),
            'bySupervisor' => $this->topNamed($reviews->groupBy(fn ($r) => $r->supervisor?->name ?? '—')->map->count(), 10),
            'avgScoreByDept' => $avgByDept,
            'scoreDistribution' => $this->scoreBuckets($scores),
        ];
    }

    /* ===================== مساعدات ===================== */

    /** يحوّل خريطة [اسم => عدد] إلى مصفوفة [{name, value}] مرتّبة تنازليًا. */
    private function named(Collection $map): array
    {
        return $map->map(fn ($value, $name) => ['name' => (string) $name, 'value' => (int) $value])
            ->sortByDesc('value')->values()->all();
    }

    /** مثل named لكن يحتفظ بأعلى N ويجمع الباقي في «أخرى». */
    private function topNamed(Collection $map, int $limit): array
    {
        $sorted = $map->sortDesc();
        $top = $sorted->take($limit);
        $rest = $sorted->skip($limit)->sum();

        $out = $top->map(fn ($value, $name) => ['name' => (string) $name, 'value' => (int) $value])->values();
        if ($rest > 0) {
            $out->push(['name' => 'أخرى', 'value' => (int) $rest]);
        }

        return $out->all();
    }

    /** سلسلة زمنية شهرية مرتّبة حسب التاريخ. */
    private function byMonth(Collection $items, string $dateField): array
    {
        return $items
            ->filter(fn ($i) => $i->{$dateField})
            ->groupBy(fn ($i) => Carbon::parse($i->{$dateField})->format('Y-m'))
            ->map(fn ($g, $key) => [
                'key' => $key,
                'name' => self::MONTHS[(int) substr($key, 5, 2)].' '.substr($key, 0, 4),
                'value' => $g->count(),
            ])
            ->sortBy('key')->values()
            ->map(fn ($r) => ['name' => $r['name'], 'value' => $r['value']])
            ->all();
    }

    /** توزيع الدرجات في شرائح بعرض 5. */
    private function scoreBuckets(Collection $scores): array
    {
        if ($scores->isEmpty()) {
            return [];
        }

        $buckets = $scores->groupBy(fn ($s) => (int) (floor($s / 5) * 5))->map->count();
        $max = (int) (floor($scores->max() / 5) * 5);

        $out = [];
        for ($i = 0; $i <= $max; $i += 5) {
            $out[] = ['name' => $i.'–'.($i + 5), 'value' => (int) ($buckets[$i] ?? 0)];
        }

        return $out;
    }
}
