<?php

namespace App\Services;

use App\Models\Coordinator;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\Visit;
use App\Models\User;
use App\Support\ActiveContext;
use Illuminate\Support\Collection;

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

    /** لوحة المتابعة: الأهداف (معلمون/منسقون) ضمن نطاق المستخدم + حالة الإنجاز. */
    public function followUp(User $user, ?int $departmentId = null): array
    {
        $yearId = $this->context->selectedYearId();
        if ($yearId === null) {
            return ['targets' => [], 'stats' => ['total' => 0, 'done' => 0, 'remaining' => 0, 'late' => 0, 'completion' => 0]];
        }

        $selectedSemesterId = $this->context->selectedSemesterId();
        $semesterClosed = in_array($this->context->selectedSemester()?->status, ['closed', 'ended'], true);

        $teachers = $this->scopedTeachers($user, $departmentId);
        $coordinators = $this->scopedCoordinators($user, $departmentId);

        $ctx = [
            'counts' => $this->visitCounts($yearId),
            'semester_id' => $selectedSemesterId,
            'semester_closed' => $semesterClosed,
        ];

        $targets = [];
        foreach ($teachers as $t) {
            $targets[] = $this->buildTarget('teacher', $t, $t->classification->required_visits ?? 1, $t->classification->name ?? null, $ctx);
        }
        foreach ($coordinators as $c) {
            $targets[] = $this->buildTarget('coordinator', $c, 1, null, $ctx);
        }

        $stats = [
            'total' => count($targets),
            'done' => count(array_filter($targets, fn ($t) => $t['status'] === 'done')),
            'remaining' => count(array_filter($targets, fn ($t) => $t['status'] === 'remaining')),
            'late' => count(array_filter($targets, fn ($t) => $t['status'] === 'late')),
        ];
        $stats['completion'] = $stats['total'] ? round($stats['done'] / $stats['total'] * 100, 1) : 0;

        return ['targets' => $targets, 'stats' => $stats];
    }

    /* ===================== مساعدات ===================== */

    private function buildTarget(string $type, $model, int $required, ?string $classification, array $ctx): array
    {
        $key = ($type === 'teacher' ? Teacher::class : Coordinator::class).':'.$model->id;
        $perSemester = $ctx['counts'][$key] ?? [];
        $doneYear = array_sum($perSemester);
        $doneSemester = $perSemester[$ctx['semester_id']] ?? 0;

        if ($doneYear >= $required) {
            $status = 'done';
        } elseif ($ctx['semester_closed']) {
            $status = 'late';
        } else {
            $status = 'remaining';
        }

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
        $query = Teacher::with(['school:id,name', 'classification:id,name,required_visits']);

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
}
