<?php

namespace App\Services;

use App\Models\Coordinator;
use App\Models\SchoolAssignment;
use App\Models\SupervisorPlan;
use App\Models\Teacher;
use App\Models\User;
use App\Support\ActiveContext;
use App\Support\Permissions;
use App\Support\SupervisionStructure;
use Illuminate\Support\Facades\DB;

/**
 * وحدة التخطيط — خطة الموجّه (خطة الزيارات والتصنيف).
 * تُولَّد صفوف الخطة مبدئيًا من مدارس الموجّه المُسندة + تصنيف المعلمين، ثم تُعتمد من رئيس القسم.
 */
class SupervisorPlanService
{
    public function __construct(private readonly ActiveContext $context) {}

    /** خطة الموجّه للعام المختار (إن وُجدت). */
    public function planFor(User $supervisor): ?SupervisorPlan
    {
        return SupervisorPlan::where('supervisor_id', $supervisor->id)->first();
    }

    /**
     * معاينة توليد الخطة من التصنيف (لا تحفظ):
     * لكل معلم في مدارس الموجّه المُسندة عددُ زيارات = required_visits لتصنيفه، وللمنسق زيارة واحدة.
     *
     * @return array{rows: list<array<string, mixed>>, error?: string}
     */
    public function generatePreview(User $supervisor): array
    {
        $departmentId = $supervisor->department_id;
        if (! $departmentId) {
            return ['rows' => [], 'error' => 'الموجّه غير مرتبط بقسم.'];
        }

        $schoolIds = SchoolAssignment::where('supervisor_id', $supervisor->id)
            ->where('department_id', $departmentId)
            ->pluck('school_id');

        if ($schoolIds->isEmpty()) {
            return ['rows' => [], 'error' => 'لا توجد مدارس مُسندة إليك. راجع شاشة توزيع المدارس أولًا.'];
        }

        $teachers = Teacher::whereIn('school_id', $schoolIds)
            ->where('department_id', $departmentId)
            ->where('is_active', true)
            ->with(['school:id,name', 'classification:id,name,required_visits,color'])
            ->orderBy('school_id')->orderBy('name')
            ->get(['id', 'school_id', 'classification_id', 'name']);

        $coordinators = Coordinator::whereIn('school_id', $schoolIds)
            ->where('department_id', $departmentId)
            ->with(['school:id,name'])
            ->orderBy('school_id')->orderBy('name')
            ->get(['id', 'school_id', 'name']);

        $rows = [];
        foreach ($teachers as $t) {
            $rows[] = [
                'kind' => 'teacher',
                'visitable_id' => $t->id,
                'name' => $t->name,
                'school_id' => $t->school_id,
                'school_name' => $t->school?->name,
                'classification_id' => $t->classification_id,
                'classification_name' => $t->classification?->name,
                'classification_color' => $t->classification?->color,
                'planned_visits' => $t->classification?->required_visits ?? 1,
                'notes' => null,
            ];
        }
        foreach ($coordinators as $c) {
            $rows[] = [
                'kind' => 'coordinator',
                'visitable_id' => $c->id,
                'name' => $c->name,
                'school_id' => $c->school_id,
                'school_name' => $c->school?->name,
                'classification_id' => null,
                'classification_name' => null,
                'classification_color' => null,
                'planned_visits' => 1,
                'notes' => null,
            ];
        }

        return ['rows' => $rows];
    }

    /**
     * حفظ/تحديث مسودة الخطة (يستبدل كل الصفوف).
     *
     * @param  list<array<string, mixed>>  $items
     */
    public function saveDraft(User $supervisor, array $items): SupervisorPlan
    {
        $this->assertEditableContext();
        abort_unless($supervisor->department_id, 422, 'الموجّه غير مرتبط بقسم.');

        return DB::transaction(function () use ($supervisor, $items) {
            $plan = SupervisorPlan::firstOrNew(['supervisor_id' => $supervisor->id]);
            abort_if($plan->exists && ! $plan->isEditable(), 422, 'لا يمكن تعديل خطة معتمدة أو قيد المراجعة.');

            $plan->department_id = $supervisor->department_id;
            $plan->created_by ??= $supervisor->id;
            if ($plan->status === 'rejected') {
                $plan->status = 'draft';      // عاد الموجّه للتعديل بعد الإرجاع
                $plan->review_notes = null;
            }
            $plan->save();

            $plan->items()->delete();
            foreach ($items as $item) {
                $plan->items()->create([
                    'school_id' => (int) $item['school_id'],
                    'visitable_type' => $this->resolveType($item['kind'] ?? 'teacher'),
                    'visitable_id' => (int) $item['visitable_id'],
                    'classification_id' => $item['classification_id'] ?? null,
                    'planned_visits' => max(0, (int) ($item['planned_visits'] ?? 1)),
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            return $plan;
        });
    }

    /** إرسال الخطة للاعتماد. */
    public function submit(SupervisorPlan $plan): void
    {
        $this->assertEditableContext();
        abort_unless($plan->isEditable(), 422, 'لا يمكن إرسال هذه الخطة.');
        abort_if($plan->items()->count() === 0, 422, 'لا يمكن إرسال خطة فارغة.');

        $plan->update([
            'status' => 'submitted',
            'submitted_at' => now(),
            'reviewed_at' => null,
            'reviewed_by' => null,
            'review_notes' => null,
        ]);
    }

    /** اعتماد الخطة من رئيس القسم. */
    public function approve(SupervisorPlan $plan, User $reviewer, ?string $notes = null): void
    {
        $this->assertEditableContext();
        abort_unless($plan->status === 'submitted', 422, 'لا يمكن اعتماد خطة ليست قيد المراجعة.');

        $plan->update([
            'status' => 'approved',
            'reviewed_at' => now(),
            'reviewed_by' => $reviewer->id,
            'review_notes' => $notes,
        ]);
    }

    /** إرجاع الخطة للموجّه مع ملاحظات. */
    public function returnForRevision(SupervisorPlan $plan, User $reviewer, string $notes): void
    {
        $this->assertEditableContext();
        abort_unless($plan->status === 'submitted', 422, 'لا يمكن إرجاع خطة ليست قيد المراجعة.');

        $plan->update([
            'status' => 'rejected',
            'reviewed_at' => now(),
            'reviewed_by' => $reviewer->id,
            'review_notes' => $notes,
        ]);
    }

    /** حمولة خطة واحدة للواجهة (مع صفوفها). */
    public function payload(SupervisorPlan $plan): array
    {
        $plan->loadMissing([
            'items.school:id,name',
            'items.classification:id,name,color',
            'items.visitable',
            'supervisor:id,name',
            'reviewer:id,name',
        ]);

        return [
            'id' => $plan->id,
            'status' => $plan->status,
            'supervisor_id' => $plan->supervisor_id,
            'supervisor_name' => $plan->supervisor?->name,
            'submitted_at' => $plan->submitted_at?->format('Y-m-d H:i'),
            'reviewed_at' => $plan->reviewed_at?->format('Y-m-d H:i'),
            'reviewer_name' => $plan->reviewer?->name,
            'review_notes' => $plan->review_notes,
            'items' => $this->mapItems($plan),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function mapItems(SupervisorPlan $plan): array
    {
        return $plan->items->map(fn ($i) => [
            'id' => $i->id,
            'kind' => $i->visitable_type === Coordinator::class ? 'coordinator' : 'teacher',
            'visitable_id' => $i->visitable_id,
            'name' => $i->visitable?->name ?? '—',
            'school_id' => $i->school_id,
            'school_name' => $i->school?->name,
            'classification_id' => $i->classification_id,
            'classification_name' => $i->classification?->name,
            'classification_color' => $i->classification?->color,
            'planned_visits' => $i->planned_visits,
            'notes' => $i->notes,
        ])->values()->all();
    }

    /**
     * نظرة رئيس القسم: صف لكل موجّه في القسم (أو في قسم محدّد لرئيس التوجيه) مع حالة خطته ونوعه.
     *
     * @return array{rows: list<array<string, mixed>>, totals: array<string, int>}
     */
    public function departmentOverview(User $user, ?int $departmentId = null): array
    {
        // رئيس التوجيه يختار القسم من البطاقات؛ رئيس القسم مقيّد بقسمه.
        $departmentId = $departmentId ?: ($user->isSuper() ? null : $user->department_id);

        $supervisorsQuery = User::query()
            ->where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR));
        if ($departmentId) {
            $supervisorsQuery->where('department_id', $departmentId);
        }
        $supervisors = $supervisorsQuery->orderBy('name')->get(['id', 'name', 'gender']);

        $plansQuery = SupervisorPlan::query()
            ->withCount('items')
            ->withSum('items as planned_total', 'planned_visits')
            ->with(['items.school:id,name', 'items.classification:id,name,color', 'items.visitable']);
        if ($departmentId) {
            $plansQuery->where('department_id', $departmentId);
        }
        $plans = $plansQuery->get()->keyBy('supervisor_id');

        $rows = $supervisors->map(function ($s) use ($plans) {
            $plan = $plans->get($s->id);

            return [
                'supervisor_id' => $s->id,
                'supervisor_name' => $s->name,
                'gender' => $s->gender,
                'plan_id' => $plan?->id,
                'status' => $plan?->status ?? 'none',
                'items_count' => (int) ($plan?->items_count ?? 0),
                'planned_total' => (int) ($plan?->planned_total ?? 0),
                'submitted_at' => $plan?->submitted_at?->format('Y-m-d'),
                'review_notes' => $plan?->review_notes,
                // تفاصيل الصفوف للمراجعة (للخطط التي أُرسلت سابقًا فقط)
                'items' => ($plan && $plan->status !== 'draft') ? $this->mapItems($plan) : [],
            ];
        })->values();

        return [
            'rows' => $rows->all(),
            'totals' => [
                'supervisors' => $supervisors->count(),
                'submitted' => $rows->where('status', 'submitted')->count(),
                'approved' => $rows->where('status', 'approved')->count(),
                'pending' => $rows->whereIn('status', ['none', 'draft', 'rejected'])->count(),
            ],
        ];
    }

    /**
     * بطاقات الأقسام لرئيس التوجيه: لكل قسم نسبة اعتماد خطط موجّهيه. @return list<array<string,mixed>>
     */
    public function departmentBoards(SupervisionStructure $structure): array
    {
        $plansByDept = SupervisorPlan::query()->get(['department_id', 'status'])->groupBy('department_id');

        return $structure->departments()->map(function ($d) use ($structure, $plansByDept) {
            $supervisors = $structure->supervisors($d->id)->count();
            $approved = $plansByDept->get($d->id, collect())->where('status', 'approved')->count();
            $remaining = max(0, $supervisors - $approved);

            return [
                'id' => $d->id,
                'name' => $d->name,
                'total' => $supervisors,
                'done' => $approved,
                'remaining' => $remaining,
                'late' => 0,
                'completion' => $supervisors ? round($approved / $supervisors * 100, 1) : 0,
            ];
        })->all();
    }

    private function resolveType(string $kind): string
    {
        return $kind === 'coordinator' ? Coordinator::class : Teacher::class;
    }

    /** الكتابة مسموحة فقط ضمن العام النشط (لا تعديل لأعوام سابقة). */
    private function assertEditableContext(): void
    {
        abort_unless($this->context->isEditable(), 422, 'لا يمكن التعديل خارج العام الدراسي النشط.');
    }
}
