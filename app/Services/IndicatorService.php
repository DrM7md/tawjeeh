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
                'teachers' => Teacher::where('is_active', true)->count(),
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
