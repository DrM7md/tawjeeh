<?php

namespace App\Services;

use App\Actions\DistributeSchoolsAction;
use App\Models\Coordinator;
use App\Models\Department;
use App\Models\School;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\User;
use App\Support\ActiveContext;
use App\Support\Permissions;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DistributionService
{
    // أوزان مكوّنات حمل المدرسة
    private const W_TEACHER = 1.0;
    private const W_COORDINATOR = 0.5;
    private const W_REQUIRED_VISIT = 0.3;
    private const BASE = 1.0;

    public function __construct(
        private readonly DistributeSchoolsAction $distributor,
        private readonly ActiveContext $context,
    ) {}

    /** الأقسام المتاحة للمستخدم للتوزيع (رئيس قسم: قسمه فقط). */
    public function availableDepartments(User $user): Collection
    {
        if ($user->isSuper() || $user->isLevel(1)) {
            return Department::orderBy('name')->get(['id', 'name']);
        }

        return Department::where('id', $user->department_id)->get(['id', 'name']);
    }

    /**
     * بطاقات الأقسام للمستوى الأعلى: لكل قسم تغطية توزيع مدارسه + عدد موجّهيه.
     * تُسقَط على شكل إحصاءات البطاقة المشتركة (total=المدارس، done=المُسندة، completion=نسبة التوزيع).
     *
     * @return list<array<string,mixed>>
     */
    public function departmentBoards(): array
    {
        $departments = Department::orderBy('name')->get(['id', 'name']);
        $schoolsTotal = $this->activeSchoolsCount();
        // ملاحظة: كل قسم يغطّي كامل المدارس، لذا total يتكرّر عمدًا لكل بطاقة قسم.

        $assignedByDept = SchoolAssignment::query()
            ->selectRaw('department_id, COUNT(DISTINCT school_id) as c')
            ->groupBy('department_id')
            ->pluck('c', 'department_id');

        $supervisorsByDept = User::where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR))
            ->selectRaw('department_id, COUNT(*) as c')
            ->groupBy('department_id')
            ->pluck('c', 'department_id');

        return $departments->map(function ($d) use ($schoolsTotal, $assignedByDept, $supervisorsByDept) {
            $assigned = (int) ($assignedByDept[$d->id] ?? 0);
            $remaining = max(0, $schoolsTotal - $assigned);

            return [
                'id' => $d->id,
                'name' => $d->name,
                'supervisors' => (int) ($supervisorsByDept[$d->id] ?? 0),
                'total' => $schoolsTotal,
                'done' => $assigned,
                'remaining' => $remaining,
                'late' => 0,
                'completion' => $schoolsTotal ? round($assigned / $schoolsTotal * 100, 1) : 0,
            ];
        })->all();
    }

    /** عدد المدارس المُفعّلة المميّزة (المرجع الحقيقي لإجمالي المدارس، بلا تكرار عبر الأقسام). */
    public function activeSchoolsCount(): int
    {
        return School::where('is_active', true)->count();
    }

    /** نظرة شاملة على توزيع قسم: الموجهون + أحمالهم + المدارس + العدالة. */
    public function overview(int $departmentId): array
    {
        $metrics = $this->schoolMetrics($departmentId);          // [school_id => [...]]
        $assignments = SchoolAssignment::where('department_id', $departmentId)
            ->get(['id', 'school_id', 'supervisor_id'])
            ->keyBy('school_id');

        $supervisors = User::where('department_id', $departmentId)
            ->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR))
            ->orderBy('name')
            ->get(['id', 'name', 'gender']);

        $schools = School::where('is_active', true)->orderBy('name')->get(['id', 'name', 'stage_id', 'gender']);

        // بناء الحمل لكل موجه
        $bySupervisor = [];
        foreach ($supervisors as $s) {
            $bySupervisor[$s->id] = [
                'id' => $s->id, 'name' => $s->name, 'gender' => $s->gender,
                'schools' => [], 'schools_count' => 0, 'teachers' => 0, 'coordinators' => 0, 'weight' => 0.0,
            ];
        }

        $unassigned = [];
        foreach ($schools as $school) {
            $m = $metrics[$school->id] ?? ['teachers' => 0, 'coordinators' => 0, 'weight' => self::BASE];
            $row = ['id' => $school->id, 'name' => $school->name, 'gender' => $school->gender, ...$m];

            $assignment = $assignments[$school->id] ?? null;
            if ($assignment && isset($bySupervisor[$assignment->supervisor_id])) {
                $sid = $assignment->supervisor_id;
                $bySupervisor[$sid]['schools'][] = $row;
                $bySupervisor[$sid]['schools_count']++;
                $bySupervisor[$sid]['teachers'] += $m['teachers'];
                $bySupervisor[$sid]['coordinators'] += $m['coordinators'];
                $bySupervisor[$sid]['weight'] += $m['weight'];
            } else {
                $unassigned[] = $row;
            }
        }

        $weights = array_map(fn ($s) => $s['weight'], array_values($bySupervisor));

        return [
            'supervisors' => array_values($bySupervisor),
            'unassigned' => $unassigned,
            'fairness' => $this->fairness($weights),
            'totals' => [
                'schools' => $schools->count(),
                'assigned' => $schools->count() - count($unassigned),
                'supervisors' => $supervisors->count(),
                'avg_schools' => $supervisors->count() ? round(($schools->count() - count($unassigned)) / $supervisors->count(), 1) : 0,
            ],
        ];
    }

    /** معاينة توزيع تلقائي (لا يحفظ). $scope: 'all' لإعادة توزيع الكل، 'unassigned' للمتبقّي فقط. */
    public function autoDistributePreview(int $departmentId, string $scope = 'unassigned'): array
    {
        $metrics = $this->schoolMetrics($departmentId);
        $supervisors = User::where('department_id', $departmentId)
            ->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR))
            ->get(['id', 'gender']);

        if ($supervisors->isEmpty()) {
            return ['assignments' => [], 'error' => 'لا يوجد موجّهون في هذا القسم'];
        }

        // الموجِّهون حسب النوع — الموجِّهات لمدارس البنات، والموجِّهون لمدارس البنين
        $maleSupervisors = $supervisors->where('gender', 'male')->pluck('id')->all();
        $femaleSupervisors = $supervisors->where('gender', 'female')->pluck('id')->all();
        $allSupervisors = $supervisors->pluck('id')->all();

        $existing = SchoolAssignment::where('department_id', $departmentId)->pluck('supervisor_id', 'school_id');
        $schools = School::where('is_active', true)->get(['id', 'gender']);
        $schoolGender = $schools->pluck('gender', 'id');

        $currentLoads = [];
        $targetSchoolIds = [];
        if ($scope === 'all') {
            $targetSchoolIds = $schools->pluck('id')->all();
        } else {
            // المتبقّي فقط — مع احتساب أحمال الموزّعين حاليًا
            foreach ($schools->pluck('id') as $sid) {
                if ($existing->has($sid)) {
                    $sup = $existing[$sid];
                    $currentLoads[$sup] = ($currentLoads[$sup] ?? 0) + ($metrics[$sid]['weight'] ?? self::BASE);
                } else {
                    $targetSchoolIds[] = $sid;
                }
            }
        }

        // قسّم المدارس المستهدفة حسب النوع
        $segments = ['girls' => [], 'boys' => [], 'mixed' => []];
        foreach ($targetSchoolIds as $sid) {
            $key = match ($schoolGender[$sid] ?? null) {
                'girls' => 'girls',
                'boys' => 'boys',
                default => 'mixed',
            };
            $segments[$key][$sid] = $metrics[$sid]['weight'] ?? self::BASE;
        }

        $result = [];
        $warnings = [];

        // مدارس البنات ← الموجِّهات، ومدارس البنين ← الموجِّهون، والمشتركة ← الجميع
        $this->distributeSegment($segments['girls'], $femaleSupervisors, $currentLoads, $metrics, $result, $warnings, 'مدرسة بنات بلا موجِّهات');
        $this->distributeSegment($segments['boys'], $maleSupervisors, $currentLoads, $metrics, $result, $warnings, 'مدرسة بنين بلا موجِّهين');
        $this->distributeSegment($segments['mixed'], $allSupervisors, $currentLoads, $metrics, $result, $warnings, 'مدرسة مشتركة بلا موجِّهين');

        // إثراء المعاينة بالأسماء
        $schoolNames = School::whereIn('id', array_keys($result))->pluck('name', 'id');
        $supNames = User::whereIn('id', array_values($result))->pluck('name', 'id');
        $preview = [];
        foreach ($result as $schoolId => $supId) {
            $preview[] = [
                'school_id' => $schoolId,
                'school_name' => $schoolNames[$schoolId] ?? '',
                'supervisor_id' => $supId,
                'supervisor_name' => $supNames[$supId] ?? '',
            ];
        }

        return ['assignments' => $preview, 'warning' => $warnings ? implode('، ', $warnings) : null];
    }

    /** حفظ مجموعة إسنادات (تلقائي أو يدوي). */
    public function saveAssignments(int $departmentId, array $pairs, string $method = 'auto'): void
    {
        DB::transaction(function () use ($departmentId, $pairs, $method) {
            foreach ($pairs as $pair) {
                $this->assign((int) $pair['school_id'], (int) $pair['supervisor_id'], $departmentId, $method);
            }
        });
    }

    /** إسناد مدرسة لموجه (يدوي/تلقائي) — يحترم UNIQUE عبر updateOrCreate. */
    public function assign(int $schoolId, int $supervisorId, int $departmentId, string $method = 'manual'): SchoolAssignment
    {
        return SchoolAssignment::updateOrCreate(
            ['academic_year_id' => $this->context->selectedYearId(), 'school_id' => $schoolId, 'department_id' => $departmentId],
            ['supervisor_id' => $supervisorId, 'assignment_method' => $method, 'assigned_by' => auth()->id()],
        );
    }

    public function unassign(int $schoolId, int $departmentId): void
    {
        SchoolAssignment::where('department_id', $departmentId)->where('school_id', $schoolId)->delete();
    }

    /** إزالة كل توزيع القسم (للعام المختار). */
    public function clear(int $departmentId): void
    {
        SchoolAssignment::where('department_id', $departmentId)->delete();
    }

    /* ===================== مساعدات ===================== */

    /**
     * يوزّع قطاعًا من المدارس على مجموعة موجِّهين، يراكم النتيجة والأحمال، ويسجّل تحذيرًا إن لم يوجد موجِّهون.
     *
     * @param  array<int, float>  $weights  [school_id => weight]
     * @param  list<int>  $supervisorIds
     * @param  array<int, float>  $loads  [supervisor_id => load] — يُحدَّث بالمرجع
     * @param  array<int, array{weight:float}>  $metrics
     * @param  array<int, int>  $result  [school_id => supervisor_id] — يُحدَّث بالمرجع
     * @param  list<string>  $warnings  — يُحدَّث بالمرجع
     */
    private function distributeSegment(array $weights, array $supervisorIds, array &$loads, array $metrics, array &$result, array &$warnings, string $noSupervisorLabel): void
    {
        if (empty($weights)) {
            return;
        }

        if (empty($supervisorIds)) {
            $warnings[] = count($weights).' '.$noSupervisorLabel;

            return;
        }

        $assignment = $this->distributor->handle($weights, $supervisorIds, $loads);
        $result += $assignment;
        $this->accumulateLoads($loads, $assignment, $metrics);
    }

    /** يراكم أوزان الإسناد على أحمال الموجِّهين (تُحدَّث بالمرجع). */
    private function accumulateLoads(array &$loads, array $assignment, array $metrics): void
    {
        foreach ($assignment as $schoolId => $supId) {
            $loads[$supId] = ($loads[$supId] ?? 0) + ($metrics[$schoolId]['weight'] ?? self::BASE);
        }
    }

    /** مقاييس كل مدرسة لقسم معيّن في العام المختار. @return array<int, array{teachers:int,coordinators:int,required_visits:int,weight:float}> */
    private function schoolMetrics(int $departmentId): array
    {
        $teachers = Teacher::where('department_id', $departmentId)
            ->where('is_active', true)
            ->with('classification:id,required_visits')
            ->get(['id', 'school_id', 'classification_id']);
        $coordinators = Coordinator::where('department_id', $departmentId)->get(['id', 'school_id']);

        $metrics = [];
        foreach ($teachers as $t) {
            $sid = $t->school_id;
            $metrics[$sid] ??= ['teachers' => 0, 'coordinators' => 0, 'required_visits' => 0];
            $metrics[$sid]['teachers']++;
            $metrics[$sid]['required_visits'] += $t->classification->required_visits ?? 1;
        }
        foreach ($coordinators as $c) {
            $sid = $c->school_id;
            $metrics[$sid] ??= ['teachers' => 0, 'coordinators' => 0, 'required_visits' => 0];
            $metrics[$sid]['coordinators']++;
            $metrics[$sid]['required_visits'] += 1; // زيارة منسق واحدة
        }

        foreach ($metrics as $sid => $m) {
            $metrics[$sid]['weight'] = round(
                self::BASE
                + $m['teachers'] * self::W_TEACHER
                + $m['coordinators'] * self::W_COORDINATOR
                + $m['required_visits'] * self::W_REQUIRED_VISIT,
                2
            );
        }

        return $metrics;
    }

    /** نسبة العدالة % = 100×(1 − معامل الاختلاف). */
    private function fairness(array $weights): float
    {
        $n = count($weights);
        if ($n === 0) {
            return 100.0;
        }
        $mean = array_sum($weights) / $n;
        if ($mean == 0.0) {
            return 100.0;
        }
        $variance = array_sum(array_map(fn ($w) => ($w - $mean) ** 2, $weights)) / $n;
        $cv = sqrt($variance) / $mean; // معامل الاختلاف
        return round(max(0, min(100, (1 - $cv) * 100)), 1);
    }
}
