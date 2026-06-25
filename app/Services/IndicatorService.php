<?php

namespace App\Services;

use App\Models\Coordinator;
use App\Models\Department;
use App\Models\School;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\TestReview;
use App\Models\User;
use App\Models\Visit;
use App\Support\Permissions;

/**
 * حساب المؤشرات ولوحات التحكم حسب الدور والعام/الفصل المختار.
 * القواعد: IND في Brain/05-BUSINESS-RULES.md.
 */
class IndicatorService
{
    public function __construct(private readonly VisitService $visits) {}

    /** يبني لوحة التحكم المناسبة لدور المستخدم. */
    public function dashboard(User $user): array
    {
        if ($user->isSuper() || $user->isLevel(1)) {
            return ['scope' => 'global', ...$this->global()];
        }

        if ($user->isLevel(2) && $user->department_id) {
            return ['scope' => 'department', ...$this->department($user->department_id)];
        }

        return ['scope' => 'supervisor', ...$this->supervisor($user)];
    }

    /* ===================== رئيس التوجيه (شامل) ===================== */
    private function global(): array
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
                'teachers' => Teacher::count(),
                'coordinators' => Coordinator::count(),
                'completion' => $overall['completion'],
                'visits_done' => Visit::count(),
                'reviews' => TestReview::count(),
            ],
            'departmentPerformance' => $departmentPerformance,
            'supervisorComparison' => $supervisorComparison,
            'statusDistribution' => [
                ['name' => 'تمت', 'value' => $overall['done']],
                ['name' => 'متبقٍ', 'value' => $overall['remaining']],
                ['name' => 'متأخر', 'value' => $overall['late']],
            ],
        ];
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
                'teachers' => Teacher::where('department_id', $departmentId)->count(),
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

    /** مقارنة الموجهين: عدد الزيارات المنجزة (الفصل المختار) + المدارس المسندة. */
    private function supervisorComparison(?int $departmentId = null): array
    {
        $query = User::whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR));
        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }

        return $query->orderBy('name')->get(['id', 'name'])->map(function ($s) use ($departmentId) {
            $visits = Visit::where('supervisor_id', $s->id)->count();
            $assignments = SchoolAssignment::where('supervisor_id', $s->id)
                ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId))
                ->count();

            return ['supervisor' => $s->name, 'visits' => $visits, 'schools' => $assignments];
        })->all();
    }
}
