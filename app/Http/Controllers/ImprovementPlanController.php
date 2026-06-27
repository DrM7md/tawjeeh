<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ResolvesDrilldown;
use App\Models\Department;
use App\Models\ImprovementPlan;
use App\Models\ImprovementReview;
use App\Models\School;
use App\Models\SchoolAssignment;
use App\Models\SelfDevelopmentPlan;
use App\Models\Teacher;
use App\Models\User;
use App\Services\ImprovementPlanService;
use App\Support\SupervisionStructure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * خطط التحسين والتطوير الذاتي — شاشة متعددة المستويات حسب الدور:
 *  - رئيس التوجيه/المساعد: الأقسام ← الموجهون ← خطط موجّه.
 *  - رئيس القسم: موجهو قسمه ← خطط موجّه.
 *  - الموجه: خططه مباشرة.
 */
class ImprovementPlanController extends Controller
{
    use ResolvesDrilldown;

    public function __construct(
        private readonly ImprovementPlanService $service,
        private readonly SupervisionStructure $structure,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $canAll = $user->isSuper() || $user->hasPermission('improvement.view.all');
        $canDept = $user->hasPermission('improvement.view.department');

        $nav = $this->resolveDrilldown($request, $user, $canAll, $canDept);

        if ($nav['level'] === 'departments') {
            return Inertia::render('improvement/index', [
                'view' => 'departments',
                'departmentCards' => $this->service->departmentBoards($this->structure),
            ]);
        }

        if ($nav['level'] === 'supervisors') {
            $department = Department::findOrFail($nav['departmentId']);

            return Inertia::render('improvement/index', [
                'view' => 'supervisors',
                'contextDepartment' => ['id' => $department->id, 'name' => $department->name],
                'supervisors' => $this->service->supervisorBoards($this->structure, $department->id),
                'canDrillDepartments' => $canAll,
            ]);
        }

        $supervisor = $nav['supervisor'];
        $isSelf = $supervisor && $supervisor->id === $user->id;
        $department = $nav['departmentId'] ? Department::find($nav['departmentId']) : null;
        $schools = $this->schoolsFor($user);

        return Inertia::render('improvement/index', [
            'view' => 'content',
            'plans' => $this->service->listPlans($user, $isSelf ? null : $supervisor?->id),
            'selfPlans' => $this->service->listSelfPlans($user, $isSelf ? null : $supervisor?->id),
            // مدارس الموجّه المكلّف بها + معلموها النشطون (تُصفّى في الواجهة حسب المدرسة المختارة)
            'schools' => $schools,
            'teachers' => $this->teachersFor($user, $schools->pluck('id')->all()),
            // المادة ثابتة من قسم الموجّه؛ والقائمة فقط لمن لا قسم له (رئيس/مساعد)
            'userDepartment' => $user->department_id ? $user->department()->first(['id', 'name']) : null,
            'departments' => $user->department_id ? [] : Department::orderBy('name')->get(['id', 'name']),
            'canCreate' => $user->hasPermission('improvement.create'),
            'canEdit' => $user->hasPermission('improvement.update'),
            'supervisor' => $isSelf || ! $supervisor ? null : ['id' => $supervisor->id, 'name' => $supervisor->name],
            'contextDepartment' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
            'canDrillSupervisors' => $canAll || $canDept,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $this->validatePlan($request, $user);
        $data['department_id'] = $user->department_id ?: $data['department_id'];

        $plan = $this->service->create($data, $user);

        return redirect()->route('improvement.show', $plan)->with('success', 'تم إنشاء خطة التحسين');
    }

    public function show(Request $request, ImprovementPlan $plan): Response
    {
        $this->authorizeView($request, $plan);
        $plan->load([
            'target:id,name', 'school:id,name', 'department:id,name', 'supervisor:id,name',
            'reviews' => fn ($q) => $q->with('creator:id,name'),
        ]);

        return Inertia::render('improvement/show', [
            'plan' => $plan,
            'canEdit' => $request->user()->hasPermission('improvement.update'),
        ]);
    }

    public function update(Request $request, ImprovementPlan $plan): RedirectResponse
    {
        $this->authorizeView($request, $plan);

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'goals' => ['nullable', 'array'],
            'goals.*' => ['nullable', 'string', 'max:500'],
            'status' => ['required', Rule::in(['active', 'completed', 'cancelled'])],
            'target_date' => ['nullable', 'date'],
        ]);

        $this->service->update($plan, $data);

        return back()->with('success', 'تم تحديث الخطة');
    }

    public function storeReview(Request $request, ImprovementPlan $plan): RedirectResponse
    {
        $this->authorizeView($request, $plan);

        $data = $request->validate([
            'review_date' => ['required', 'date'],
            'progress_note' => ['nullable', 'string', 'max:2000'],
            'next_steps' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->service->addReview($plan, $data, $request->user());

        return back()->with('success', 'تم تسجيل المراجعة');
    }

    public function destroyReview(Request $request, ImprovementReview $review): RedirectResponse
    {
        $review->loadMissing('plan');
        $this->authorizeView($request, $review->plan);
        $review->delete();

        return back()->with('success', 'تم حذف المراجعة');
    }

    public function destroy(Request $request, ImprovementPlan $plan): RedirectResponse
    {
        $this->authorizeView($request, $plan);
        $this->service->delete($plan);

        return redirect()->route('improvement.index')->with('success', 'تم حذف الخطة');
    }

    /* ===================== خطط التطوير الذاتي ===================== */

    public function storeSelf(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $this->validatePlan($request, $user, withDates: false);
        $data['department_id'] = $user->department_id ?: $data['department_id'];
        $data['supervisor_feedback'] = $request->input('supervisor_feedback');

        $this->service->createSelf($data, $user);

        return redirect()->route('improvement.index')->with('success', 'تم إنشاء خطة التطوير الذاتي');
    }

    public function updateSelf(Request $request, SelfDevelopmentPlan $selfPlan): RedirectResponse
    {
        $this->authorizeViewSelf($request, $selfPlan);

        $data = $request->validate([
            'goals' => ['nullable', 'array'],
            'goals.*' => ['nullable', 'string', 'max:500'],
            'supervisor_feedback' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', Rule::in(['active', 'completed', 'cancelled'])],
        ]);

        $this->service->updateSelf($selfPlan, $data);

        return back()->with('success', 'تم تحديث خطة التطوير الذاتي');
    }

    public function destroySelf(Request $request, SelfDevelopmentPlan $selfPlan): RedirectResponse
    {
        $this->authorizeViewSelf($request, $selfPlan);
        $this->service->deleteSelf($selfPlan);

        return redirect()->route('improvement.index')->with('success', 'تم حذف خطة التطوير الذاتي');
    }

    /* ===================== مساعدات ===================== */

    /** قواعد التحقّق المشتركة لإنشاء خطة (تحسين/تطوير ذاتي). */
    private function validatePlan(Request $request, User $user, bool $withDates = true): array
    {
        $rules = [
            'target_kind' => ['nullable', Rule::in(['teacher', 'coordinator'])],
            'target_id' => ['required', 'integer'],
            'school_id' => ['required', 'exists:schools,id'],
            'department_id' => [Rule::requiredIf(! $user->department_id), 'nullable', 'exists:departments,id'],
            'title' => ['nullable', 'string', 'max:255'],
            'goals' => ['nullable', 'array'],
            'goals.*' => ['nullable', 'string', 'max:500'],
        ];
        if ($withDates) {
            $rules['start_date'] = ['nullable', 'date'];
            $rules['target_date'] = ['nullable', 'date'];
        }

        return $request->validate($rules);
    }

    /**
     * مدارس نموذج الإنشاء: الموجّه يرى مدارسه المكلّف بها؛
     * رئيس القسم مدارس قسمه؛ المشرف العام كل المدارس النشطة.
     */
    private function schoolsFor(User $user): \Illuminate\Support\Collection
    {
        $query = School::where('is_active', true)->orderBy('name')->with('stage:id,name');

        if (! ($user->isSuper() || $user->hasPermission('improvement.view.all'))) {
            $assignments = SchoolAssignment::query();
            if ($user->hasPermission('improvement.view.department') && $user->department_id) {
                $assignments->where('department_id', $user->department_id);
            } else {
                $assignments->where('supervisor_id', $user->id);
            }
            $query->whereIn('id', $assignments->pluck('school_id'));
        }

        return $query->get(['id', 'name', 'stage_id']);
    }

    /** المعلمون النشطون ضمن مدارس الموجّه (مصفّون بقسمه إن وُجد). */
    private function teachersFor(User $user, array $schoolIds): \Illuminate\Support\Collection
    {
        if (empty($schoolIds)) {
            return collect();
        }

        return Teacher::active()
            ->whereIn('school_id', $schoolIds)
            ->when($user->department_id, fn ($q) => $q->where('department_id', $user->department_id))
            ->orderBy('name')
            ->get(['id', 'name', 'school_id', 'department_id']);
    }

    private function authorizeView(Request $request, ImprovementPlan $plan): void
    {
        abort_unless($this->canView($request->user(), $plan->department_id, $plan->supervisor_id), 403);
    }

    private function authorizeViewSelf(Request $request, SelfDevelopmentPlan $plan): void
    {
        abort_unless($this->canView($request->user(), $plan->department_id, $plan->supervisor_id), 403);
    }

    private function canView(User $user, ?int $departmentId, int $supervisorId): bool
    {
        return $user->isSuper()
            || $user->hasPermission('improvement.view.all')
            || ($user->hasPermission('improvement.view.department') && $departmentId === $user->department_id)
            || $supervisorId === $user->id;
    }
}
