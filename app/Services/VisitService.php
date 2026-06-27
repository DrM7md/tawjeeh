<?php

namespace App\Services;

use App\Models\Coordinator;
use App\Models\Department;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\User;
use App\Models\Visit;
use App\Models\VisitRating;
use App\Models\VisitTemplate;
use App\Support\ActiveContext;
use App\Support\Permissions;
use App\Support\SupervisionRatings;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * منطق الزيارات والمتابعة. القواعد: VS في Brain/05-BUSINESS-RULES.md.
 */
class VisitService
{
    public function __construct(private readonly ActiveContext $context) {}

    /** قائمة الزيارات ضمن نطاق المستخدم (مفلترة بالعام/الفصل المختار). */
    public function list(User $user): Collection
    {
        return Visit::query()
            ->visibleTo($user)
            ->with(['school:id,name', 'supervisor:id,name', 'department:id,name', 'visitable', 'form:id,visit_id,save_status'])
            ->latest('visit_date')
            ->get();
    }

    public function record(array $data): Visit
    {
        return Visit::create([
            'supervisor_id' => $data['supervisor_id'] ?? auth()->id(),
            'school_id' => $data['school_id'],
            'department_id' => $data['department_id'],
            'visit_type' => $data['visit_type'],
            'visitable_type' => $data['visit_type'] === 'teacher' ? Teacher::class : Coordinator::class,
            'visitable_id' => $data['visitable_id'],
            'visit_date' => $data['visit_date'],
            'status' => 'done',
            'created_by' => auth()->id(),
        ]);
    }

    /**
     * لوحة المتابعة: الأهداف (معلمون/منسقون) + حالة الإنجاز.
     * النطاق الافتراضي = نطاق $user؛ ولو مُرّر $supervisor فالنطاق = مدارسه المكلّف بها.
     */
    public function followUp(User $user, ?int $departmentId = null, ?User $supervisor = null): array
    {
        $yearId = $this->context->selectedYearId();
        if ($yearId === null) {
            return ['targets' => [], 'stats' => $this->emptyStats()];
        }

        $ctx = $this->buildContext($yearId);

        if ($supervisor) {
            [$teachers, $coordinators] = $this->supervisorScopedTargets($supervisor, $departmentId);
        } else {
            $teachers = $this->scopedTeachers($user, $departmentId);
            $coordinators = $this->scopedCoordinators($user, $departmentId);
        }

        $targets = $this->buildTargets($teachers, $coordinators, $ctx);

        return ['targets' => $targets, 'stats' => $this->summarize($targets)];
    }

    /**
     * بطاقات الأقسام: لكل قسم نسبة إنجاز مستهدفيه (للمستوى الأعلى — رئيس التوجيه).
     *
     * @return list<array<string,mixed>>
     */
    public function departmentBoards(): array
    {
        $departments = Department::where('is_active', true)->orderBy('name')->get(['id', 'name']);
        $yearId = $this->context->selectedYearId();

        if ($yearId === null) {
            return $departments->map(fn ($d) => array_merge(['id' => $d->id, 'name' => $d->name], $this->emptyStats()))->all();
        }

        $ctx = $this->buildContext($yearId);
        $teachers = Teacher::where('is_active', true)->with('classification:id,name,required_visits')->get()->groupBy('department_id');
        $coordinators = Coordinator::get()->groupBy('department_id');

        return $departments->map(function ($d) use ($teachers, $coordinators, $ctx) {
            $stats = $this->statsFor($teachers->get($d->id, collect()), $coordinators->get($d->id, collect()), $ctx);

            return array_merge(['id' => $d->id, 'name' => $d->name], $stats);
        })->all();
    }

    /**
     * بطاقات الموجهين في قسم: لكل موجّه نسبة إنجاز مدارسه المكلّف بها.
     *
     * @return list<array<string,mixed>>
     */
    public function supervisorBoards(int $departmentId): array
    {
        $supervisors = User::where('department_id', $departmentId)
            ->where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR))
            ->orderBy('name')->get(['id', 'name']);

        $yearId = $this->context->selectedYearId();
        if ($yearId === null || $supervisors->isEmpty()) {
            return $supervisors->map(fn ($s) => array_merge(['id' => $s->id, 'name' => $s->name, 'schools' => 0], $this->emptyStats()))->all();
        }

        $ctx = $this->buildContext($yearId);
        $assignments = SchoolAssignment::whereIn('supervisor_id', $supervisors->pluck('id'))
            ->get(['supervisor_id', 'school_id'])->groupBy('supervisor_id');

        $schoolIds = $assignments->flatten(1)->pluck('school_id')->unique();
        $teachers = Teacher::where('is_active', true)->whereIn('school_id', $schoolIds)
            ->with('classification:id,name,required_visits')->get()->groupBy('school_id');
        $coordinators = Coordinator::whereIn('school_id', $schoolIds)->get()->groupBy('school_id');

        return $supervisors->map(function ($s) use ($assignments, $teachers, $coordinators, $ctx) {
            $sids = ($assignments->get($s->id) ?? collect())->pluck('school_id');
            $ts = $sids->flatMap(fn ($id) => $teachers->get($id, collect()));
            $cs = $sids->flatMap(fn ($id) => $coordinators->get($id, collect()));
            $stats = $this->statsFor($ts, $cs, $ctx);

            return array_merge(['id' => $s->id, 'name' => $s->name, 'schools' => $sids->count()], $stats);
        })->all();
    }

    /** زيارات موجّه محدد (للعام/الفصل المختار). */
    public function listForSupervisor(User $supervisor): Collection
    {
        return Visit::query()
            ->where('supervisor_id', $supervisor->id)
            ->with(['school:id,name', 'supervisor:id,name', 'department:id,name', 'visitable', 'form:id,visit_id,save_status'])
            ->latest('visit_date')
            ->get();
    }

    /* ===================== مساعدات ===================== */

    /** سياق العدّ المشترك (خريطة الزيارات + الفصل المختار + هل أُغلق). @return array<string,mixed> */
    private function buildContext(int $yearId): array
    {
        return [
            'counts' => $this->visitCounts($yearId),
            'semester_id' => $this->context->selectedSemesterId(),
            'semester_closed' => (bool) $this->context->selectedSemester()?->hasEnded(),
        ];
    }

    /** @return list<array<string,mixed>> */
    private function buildTargets(Collection $teachers, Collection $coordinators, array $ctx): array
    {
        $targets = [];
        foreach ($teachers as $t) {
            $targets[] = $this->buildTarget('teacher', $t, $t->classification->required_visits ?? 1, $t->classification->name ?? null, $ctx);
        }
        foreach ($coordinators as $c) {
            $targets[] = $this->buildTarget('coordinator', $c, 1, null, $ctx);
        }

        return $targets;
    }

    /** إحصائيات الإنجاز من المجموعات مباشرة (دون بناء الكائنات الكاملة). @return array<string,mixed> */
    private function statsFor(Collection $teachers, Collection $coordinators, array $ctx): array
    {
        $statuses = [];
        foreach ($teachers as $t) {
            $statuses[] = $this->statusOf('teacher', $t, $t->classification->required_visits ?? 1, $ctx);
        }
        foreach ($coordinators as $c) {
            $statuses[] = $this->statusOf('coordinator', $c, 1, $ctx);
        }

        $total = count($statuses);
        $done = count(array_filter($statuses, fn ($s) => $s === 'done'));

        return [
            'total' => $total,
            'done' => $done,
            'remaining' => count(array_filter($statuses, fn ($s) => $s === 'remaining')),
            'late' => count(array_filter($statuses, fn ($s) => $s === 'late')),
            'completion' => $total ? round($done / $total * 100, 1) : 0,
        ];
    }

    /** @param list<array<string,mixed>> $targets @return array<string,mixed> */
    private function summarize(array $targets): array
    {
        $total = count($targets);
        $done = count(array_filter($targets, fn ($t) => $t['status'] === 'done'));

        return [
            'total' => $total,
            'done' => $done,
            'remaining' => count(array_filter($targets, fn ($t) => $t['status'] === 'remaining')),
            'late' => count(array_filter($targets, fn ($t) => $t['status'] === 'late')),
            'completion' => $total ? round($done / $total * 100, 1) : 0,
        ];
    }

    /** @return array<string,int|float> */
    private function emptyStats(): array
    {
        return ['total' => 0, 'done' => 0, 'remaining' => 0, 'late' => 0, 'completion' => 0];
    }

    /** المعلمون/المنسقون ضمن مدارس موجّه محدد. @return array{0:Collection,1:Collection} */
    private function supervisorScopedTargets(User $supervisor, ?int $departmentId): array
    {
        $schoolIds = SchoolAssignment::where('supervisor_id', $supervisor->id)
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId))
            ->pluck('school_id');

        $teachers = Teacher::where('is_active', true)
            ->whereIn('school_id', $schoolIds)
            ->with(['school:id,name', 'classification:id,name,required_visits'])
            ->get();

        $coordinators = Coordinator::whereIn('school_id', $schoolIds)
            ->with('school:id,name')
            ->get();

        return [$teachers, $coordinators];
    }

    /** حالة المستهدف: done / late / remaining. */
    private function statusOf(string $type, $model, int $required, array $ctx): string
    {
        $key = ($type === 'teacher' ? Teacher::class : Coordinator::class).':'.$model->id;
        $doneYear = array_sum($ctx['counts'][$key] ?? []);

        if ($doneYear >= $required) {
            return 'done';
        }

        return $ctx['semester_closed'] ? 'late' : 'remaining';
    }

    private function buildTarget(string $type, $model, int $required, ?string $classification, array $ctx): array
    {
        $key = ($type === 'teacher' ? Teacher::class : Coordinator::class).':'.$model->id;
        $perSemester = $ctx['counts'][$key] ?? [];
        $doneYear = array_sum($perSemester);
        $doneSemester = $perSemester[$ctx['semester_id']] ?? 0;
        $status = $this->statusOf($type, $model, $required, $ctx);

        return [
            'id' => $model->id,
            'type' => $type,
            'name' => $model->name,
            'school' => $model->school?->name,
            'school_id' => $model->school_id,
            'department_id' => $model->department_id,
            'classification' => $classification,
            'required' => $required,
            'done_year' => $doneYear,
            'done_semester' => $doneSemester,
            'status' => $status,
        ];
    }

    /** خريطة عدد الزيارات: ["Type:id" => [semester_id => count]] للعام كله. */
    private function visitCounts(int $yearId): array
    {
        $rows = Visit::withoutAcademicContext()
            ->where('academic_year_id', $yearId)
            ->selectRaw('visitable_type, visitable_id, semester_id, COUNT(*) as c')
            ->groupBy('visitable_type', 'visitable_id', 'semester_id')
            ->get();

        $map = [];
        foreach ($rows as $r) {
            $map[$r->visitable_type.':'.$r->visitable_id][$r->semester_id] = (int) $r->c;
        }

        return $map;
    }

    private function scopedTeachers(User $user, ?int $departmentId): Collection
    {
        $query = Teacher::where('is_active', true)->with(['school:id,name', 'classification:id,name,required_visits']);

        return $this->applyScope($query, $user, $departmentId)->get();
    }

    private function scopedCoordinators(User $user, ?int $departmentId): Collection
    {
        $query = Coordinator::with('school:id,name');

        return $this->applyScope($query, $user, $departmentId)->get();
    }

    private function applyScope($query, User $user, ?int $departmentId)
    {
        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }

        if ($user->isSuper() || $user->hasPermission('visits.view.all')) {
            return $query;
        }

        if ($user->hasPermission('visits.view.department') && $user->department_id) {
            return $query->where('department_id', $user->department_id);
        }

        // الموجه: فقط مدارسه المكلّف بها
        $schoolIds = SchoolAssignment::where('supervisor_id', $user->id)->pluck('school_id');

        return $query->whereIn('school_id', $schoolIds);
    }

    /** تطبيق نطاق المستخدم على استعلام معلمين (للتقارير). */
    public function applyReportScope($query, User $user)
    {
        return $this->applyScope($query, $user, null);
    }

    /* ===================== استمارة الإشراف الجديدة ===================== */

    /** المعلمون ضمن نطاق المستخدم (لاختيارهم في الاستمارة). */
    public function teachersInScope(User $user): Collection
    {
        $query = Teacher::where('is_active', true)->with(['school:id,name', 'department:id,name']);

        return $this->applyScope($query, $user, null)->orderBy('name')->get()->map(fn (Teacher $t) => [
            'id' => $t->id,
            'name' => $t->name,
            'school_id' => $t->school_id,
            'school' => $t->school?->name,
            'department_id' => $t->department_id,
            'department' => $t->department?->name,
        ])->values();
    }

    /** قالب القسم (وإلا أول قالب مفعّل) مع بنيته الكاملة. */
    public function resolveTemplate(?int $departmentId): ?VisitTemplate
    {
        $with = ['domains.standards.recommendations'];

        $template = $departmentId
            ? Department::find($departmentId)?->visitTemplates()->with($with)->first()
            : null;

        return $template ?? VisitTemplate::where('is_active', true)->with($with)->first();
    }

    /** @return array<string,mixed> سياق المعلم: القالب + الإحصائيات + التوصيات السابقة. */
    public function teacherContext(Teacher $teacher, ?int $excludeVisitId = null): array
    {
        $template = $this->resolveTemplate($teacher->department_id);
        $personVisits = $this->personVisits($teacher, $excludeVisitId);

        return [
            'template' => $template ? $this->templatePayload($template) : null,
            'visit_number' => $personVisits->count() + 1,
            'total_visits' => $personVisits->count(),
            'previous_rating' => optional($personVisits->first())->overall_rating,
            'previous_recommendations' => $personVisits->take(10)->map(fn (Visit $v) => [
                'id' => $v->id,
                'date' => $v->visit_date?->toDateString(),
                'year' => $v->academicYear?->name,
                'overall_rating' => $v->overall_rating,
                'general_notes' => $v->form?->general_notes,
                'recommendations' => $v->ratings
                    ->filter(fn ($r) => filled($r->recommendation))
                    ->map(fn ($r) => ['standard' => $r->standard?->name, 'text' => $r->recommendation])
                    ->values(),
            ])->values(),
        ];
    }

    /** زيارات نفس الشخص عبر الأعوام (ربط بالرقم الشخصي) مرتّبة تنازليًا. */
    private function personVisits(Teacher $teacher, ?int $excludeVisitId = null): Collection
    {
        $teacherIds = $teacher->national_id
            ? Teacher::withoutAcademicContext()->where('national_id', $teacher->national_id)->pluck('id')
            : collect([$teacher->id]);

        return Visit::withoutAcademicContext()
            ->where('visitable_type', Teacher::class)
            ->whereIn('visitable_id', $teacherIds)
            ->when($excludeVisitId, fn ($q) => $q->where('id', '!=', $excludeVisitId))
            ->with([
                'ratings' => fn ($q) => $q->with('standard:id,name'),
                'academicYear:id,name',
                'form:id,visit_id,general_notes',
            ])
            ->orderByDesc('visit_date')->orderByDesc('id')
            ->get();
    }

    /** @return array<string,mixed> */
    public function templatePayload(VisitTemplate $template): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'domains' => $template->domains->map(fn ($d) => [
                'id' => $d->id,
                'name' => $d->name,
                'standards' => $d->standards->map(fn ($s) => [
                    'id' => $s->id,
                    'name' => $s->name,
                    'recommendations' => $s->recommendations->map(fn ($r) => ['id' => $r->id, 'text' => $r->text])->values(),
                ])->values(),
            ])->values(),
        ];
    }

    /**
     * إنشاء/تحديث زيارة إشرافية كاملة (الزيارة + الاستمارة + درجات المعايير).
     *
     * @param  array<string,mixed>  $data
     */
    public function saveSupervision(array $data, User $user, ?Visit $visit = null): Visit
    {
        $teacher = Teacher::findOrFail($data['teacher_id']);
        $template = $this->resolveTemplate($teacher->department_id);

        $ratings = collect($data['ratings'] ?? []);
        $overall = SupervisionRatings::percent($ratings->pluck('rating_value')->all());

        return DB::transaction(function () use ($data, $user, $visit, $teacher, $template, $ratings, $overall) {
            if ($visit) {
                $visit->update([
                    'visit_date' => $data['visit_date'],
                    'follow_up_type' => $data['follow_up_type'] ?? null,
                    'section' => $data['section'] ?? null,
                    'lesson_topic' => $data['lesson_topic'] ?? null,
                    'overall_rating' => $overall,
                    'template_id' => $template?->id,
                ]);
            } else {
                $visitNumber = $this->personVisits($teacher)->count() + 1;
                $visit = Visit::create([
                    'supervisor_id' => $user->id,
                    'school_id' => $teacher->school_id,
                    'department_id' => $teacher->department_id,
                    'template_id' => $template?->id,
                    'visit_type' => 'teacher',
                    'visitable_type' => Teacher::class,
                    'visitable_id' => $teacher->id,
                    'section' => $data['section'] ?? null,
                    'lesson_topic' => $data['lesson_topic'] ?? null,
                    'follow_up_type' => $data['follow_up_type'] ?? null,
                    'visit_date' => $data['visit_date'],
                    'visit_number' => $visitNumber,
                    'overall_rating' => $overall,
                    'status' => 'done',
                    'created_by' => $user->id,
                ]);
            }

            $visit->form()->updateOrCreate(
                ['visit_id' => $visit->id],
                ['general_notes' => $data['general_notes'] ?? null, 'save_status' => 'final', 'finalized_at' => now()],
            );

            // مزامنة درجات المعايير
            $validStandardIds = $template
                ? $template->domains->flatMap->standards->pluck('id')->all()
                : [];
            $visit->ratings()->delete();
            foreach ($ratings as $r) {
                if (! in_array((int) ($r['standard_id'] ?? 0), $validStandardIds, true)) {
                    continue;
                }
                VisitRating::create([
                    'visit_id' => $visit->id,
                    'visit_standard_id' => (int) $r['standard_id'],
                    'rating_value' => (int) ($r['rating_value'] ?? 0),
                    'recommendation' => filled($r['recommendation'] ?? null) ? $r['recommendation'] : null,
                ]);
            }

            return $visit;
        });
    }
}
