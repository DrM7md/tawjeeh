<?php

namespace App\Services;

use App\Models\Coordinator;
use App\Models\ImprovementPlan;
use App\Models\ImprovementReview;
use App\Models\SelfDevelopmentPlan;
use App\Models\Teacher;
use App\Models\User;
use App\Support\SupervisionStructure;
use Illuminate\Support\Collection;

/**
 * خطط التحسين والتطوير الذاتي + المراجعات الدورية.
 * المرجع: خريطة التطوير §1.3
 */
class ImprovementPlanService
{
    /** يحوّل نوع الهدف القادم من الواجهة إلى صنف الموديل. */
    public function resolveTargetType(string $kind): string
    {
        return $kind === 'coordinator' ? Coordinator::class : Teacher::class;
    }

    /* ===================== خطط التحسين ===================== */

    public function listPlans(User $user, ?int $supervisorId = null): Collection
    {
        return ImprovementPlan::query()
            ->visibleTo($user)
            ->when($supervisorId, fn ($q) => $q->where('supervisor_id', $supervisorId))
            ->with(['target:id,name', 'school:id,name', 'department:id,name', 'supervisor:id,name'])
            ->withCount('reviews')
            ->withMax('reviews', 'review_date') // reviews_max_review_date — لاحتساب تأخّر المراجعة
            ->latest('id')
            ->get();
    }

    /**
     * بطاقات الأقسام: لكل قسم نسبة خطط التحسين المكتملة. @return list<array<string,mixed>>
     */
    public function departmentBoards(SupervisionStructure $structure): array
    {
        $byDept = ImprovementPlan::query()->get(['department_id', 'status'])->groupBy('department_id');

        return $structure->departments()->map(fn ($d) => array_merge(
            ['id' => $d->id, 'name' => $d->name],
            $this->planStats($byDept->get($d->id, collect())),
        ))->all();
    }

    /**
     * بطاقات الموجهين في قسم: لكل موجّه خطط تحسينه (مع عدد مدارسه المكلّف بها). @return list<array<string,mixed>>
     */
    public function supervisorBoards(SupervisionStructure $structure, int $departmentId): array
    {
        $supervisors = $structure->supervisors($departmentId);
        if ($supervisors->isEmpty()) {
            return [];
        }

        $schoolsBySup = $structure->schoolIdsBySupervisor($supervisors->pluck('id'));
        $bySup = ImprovementPlan::whereIn('supervisor_id', $supervisors->pluck('id'))
            ->where('department_id', $departmentId)
            ->get(['supervisor_id', 'status'])->groupBy('supervisor_id');

        return $supervisors->map(fn ($s) => array_merge(
            ['id' => $s->id, 'name' => $s->name, 'gender' => $s->gender, 'schools' => $schoolsBySup->get($s->id, collect())->count()],
            $this->planStats($bySup->get($s->id, collect())),
        ))->all();
    }

    /** إحصاء بطاقة من خطط (total=الكل، done=المكتملة، remaining=الباقي). @return array<string,int|float> */
    private function planStats(Collection $plans): array
    {
        $total = $plans->count();
        $completed = $plans->where('status', 'completed')->count();

        return [
            'total' => $total,
            'done' => $completed,
            'remaining' => $total - $completed,
            'late' => 0,
            'completion' => $total ? round($completed / $total * 100, 1) : 0,
        ];
    }

    public function create(array $data, User $user): ImprovementPlan
    {
        return ImprovementPlan::create([
            'target_type' => $this->resolveTargetType($data['target_kind'] ?? 'teacher'),
            'target_id' => $data['target_id'],
            'school_id' => $data['school_id'],
            'supervisor_id' => $user->id,
            'department_id' => $data['department_id'],
            'title' => $data['title'] ?? null,
            'goals' => $this->cleanGoals($data['goals'] ?? []),
            'status' => 'active',
            'start_date' => $data['start_date'] ?? now()->toDateString(),
            'target_date' => $data['target_date'] ?? null,
            'created_by' => $user->id,
        ]);
    }

    public function update(ImprovementPlan $plan, array $data): ImprovementPlan
    {
        $plan->update([
            'title' => $data['title'] ?? $plan->title,
            'goals' => $this->cleanGoals($data['goals'] ?? $plan->goals ?? []),
            'status' => $data['status'] ?? $plan->status,
            'target_date' => $data['target_date'] ?? $plan->target_date,
        ]);

        return $plan;
    }

    public function addReview(ImprovementPlan $plan, array $data, User $user): ImprovementReview
    {
        return $plan->reviews()->create([
            'review_date' => $data['review_date'] ?? now()->toDateString(),
            'progress_note' => $data['progress_note'] ?? null,
            'next_steps' => $data['next_steps'] ?? null,
            'created_by' => $user->id,
        ]);
    }

    public function delete(ImprovementPlan $plan): void
    {
        $plan->delete();
    }

    /* ===================== خطط التطوير الذاتي ===================== */

    public function listSelfPlans(User $user, ?int $supervisorId = null): Collection
    {
        return SelfDevelopmentPlan::query()
            ->visibleTo($user)
            ->when($supervisorId, fn ($q) => $q->where('supervisor_id', $supervisorId))
            ->with(['target:id,name', 'school:id,name', 'department:id,name', 'supervisor:id,name'])
            ->latest('id')
            ->get();
    }

    public function createSelf(array $data, User $user): SelfDevelopmentPlan
    {
        return SelfDevelopmentPlan::create([
            'target_type' => $this->resolveTargetType($data['target_kind'] ?? 'teacher'),
            'target_id' => $data['target_id'],
            'school_id' => $data['school_id'],
            'supervisor_id' => $user->id,
            'department_id' => $data['department_id'],
            'goals' => $this->cleanGoals($data['goals'] ?? []),
            'supervisor_feedback' => $data['supervisor_feedback'] ?? null,
            'status' => 'active',
            'created_by' => $user->id,
        ]);
    }

    public function updateSelf(SelfDevelopmentPlan $plan, array $data): SelfDevelopmentPlan
    {
        $plan->update([
            'goals' => $this->cleanGoals($data['goals'] ?? $plan->goals ?? []),
            'supervisor_feedback' => $data['supervisor_feedback'] ?? $plan->supervisor_feedback,
            'status' => $data['status'] ?? $plan->status,
        ]);

        return $plan;
    }

    public function deleteSelf(SelfDevelopmentPlan $plan): void
    {
        $plan->delete();
    }

    /** يزيل الأهداف الفارغة ويعيد فهرسة القائمة. @return list<string> */
    private function cleanGoals(array $goals): array
    {
        return array_values(array_filter(array_map(
            fn ($g) => trim((string) $g),
            $goals,
        ), fn ($g) => $g !== ''));
    }
}
