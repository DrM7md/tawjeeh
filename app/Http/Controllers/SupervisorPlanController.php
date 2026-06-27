<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\NotificationSetting;
use App\Models\SupervisorPlan;
use App\Notifications\DomainNotification;
use App\Notifications\NotificationType;
use App\Services\NotificationDispatcher;
use App\Services\SupervisorPlanService;
use App\Support\ActiveContext;
use App\Support\SupervisionStructure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SupervisorPlanController extends Controller
{
    public function __construct(
        private readonly SupervisorPlanService $service,
        private readonly NotificationDispatcher $notifications,
        private readonly ActiveContext $context,
        private readonly SupervisionStructure $structure,
    ) {}

    /**
     * شاشة التخطيط حسب الدور:
     *  - الموجه: محرّر خطته مباشرة.
     *  - رئيس القسم: نظرة موجهي قسمه (مع تبويب بنين/بنات) ومراجعة خططهم.
     *  - رئيس التوجيه/المساعد: بطاقات الأقسام ← نظرة موجهي القسم المختار.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $canCreate = $user->can('planning.create');
        $canApprove = $user->can('planning.approve');
        $canAll = $user->isSuper() || $user->isLevel(1);

        // رئيس التوجيه/المساعد يبدأ ببطاقات الأقسام، ثم يختار قسمًا من الرابط.
        $departmentId = null;
        if ($canApprove) {
            if ($canAll) {
                $departmentId = $request->integer('department') ?: null;
                if ($departmentId === null) {
                    return Inertia::render('planning/index', [
                        'view' => 'departments',
                        'departmentCards' => $this->service->departmentBoards($this->structure),
                    ]);
                }
            } else {
                $departmentId = $user->department_id; // رئيس القسم: قسمه فقط
            }
        }

        $myPlan = $canCreate ? $this->service->planFor($user) : null;
        $department = $departmentId ? Department::find($departmentId) : null;

        return Inertia::render('planning/index', [
            'view' => 'board',
            'canCreate' => $canCreate,
            'canApprove' => $canApprove,
            'isEditable' => $this->context->isEditable(),
            'myPlan' => $myPlan ? $this->service->payload($myPlan) : null,
            'preview' => $request->session()->get('plan_preview'),
            'departmentOverview' => $canApprove ? $this->service->departmentOverview($user, $departmentId) : null,
            'contextDepartment' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
            'canDrillDepartments' => $canAll && $canApprove,
        ]);
    }

    /** معاينة توليد الخطة من التصنيف (تمرّر عبر الجلسة ثم إعادة توجيه 303). */
    public function generatePreview(Request $request): RedirectResponse
    {
        return redirect()
            ->route('planning.index', [], 303)
            ->with('plan_preview', $this->service->generatePreview($request->user()));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateItems($request);
        $this->service->saveDraft($request->user(), $data['items']);

        return back(303)->with('success', 'تم حفظ مسودة الخطة');
    }

    public function submit(Request $request, SupervisorPlan $plan): RedirectResponse
    {
        $this->authorizeOwner($request, $plan);
        $this->service->submit($plan);

        $this->notifications->send(
            NotificationType::PLAN_SUBMITTED,
            [
                'title' => 'خطة بانتظار الاعتماد',
                'message' => 'أرسل '.$request->user()->name.' خطة زياراته للاعتماد',
                'url' => route('planning.index'),
            ],
            $plan->department_id,
            $request->user()->id,
        );

        return back(303)->with('success', 'تم إرسال الخطة للاعتماد');
    }

    public function approve(Request $request, SupervisorPlan $plan): RedirectResponse
    {
        $this->authorizeReviewer($request, $plan);
        $notes = $request->validate(['notes' => ['nullable', 'string', 'max:2000']])['notes'] ?? null;

        $this->service->approve($plan, $request->user(), $notes);
        $this->notifyOwnerReviewed($plan, 'تم اعتماد خطتك من رئيس القسم');

        return back(303)->with('success', 'تم اعتماد الخطة');
    }

    public function returnForRevision(Request $request, SupervisorPlan $plan): RedirectResponse
    {
        $this->authorizeReviewer($request, $plan);
        $notes = $request->validate(['notes' => ['required', 'string', 'max:2000']])['notes'];

        $this->service->returnForRevision($plan, $request->user(), $notes);
        $this->notifyOwnerReviewed($plan, 'أُرجعت خطتك للتعديل: '.$notes);

        return back(303)->with('success', 'تم إرجاع الخطة للموجّه');
    }

    /** إشعار الموجّه صاحب الخطة بنتيجة المراجعة (مستلم محدّد لا دور). */
    private function notifyOwnerReviewed(SupervisorPlan $plan, string $message): void
    {
        $config = NotificationSetting::for(NotificationType::PLAN_REVIEWED);
        if (! $config || ! $config['enabled'] || ! $plan->supervisor) {
            return;
        }

        $plan->supervisor->notify(new DomainNotification(
            typeKey: NotificationType::PLAN_REVIEWED,
            title: 'نتيجة اعتماد الخطة',
            message: $message,
            url: route('planning.index'),
            icon: 'visit',
            live: (bool) $config['live'],
        ));
    }

    private function authorizeOwner(Request $request, SupervisorPlan $plan): void
    {
        abort_unless($plan->supervisor_id === $request->user()->id, 403, 'هذه ليست خطتك.');
    }

    private function authorizeReviewer(Request $request, SupervisorPlan $plan): void
    {
        $user = $request->user();
        if ($user->department_id && ! $user->isSuper()) {
            abort_unless($plan->department_id === $user->department_id, 403, 'لا تملك صلاحية على هذا القسم.');
        }
    }

    /** @return array{items: list<array<string, mixed>>} */
    private function validateItems(Request $request): array
    {
        return $request->validate([
            'items' => ['present', 'array'],
            'items.*.kind' => ['required', 'in:teacher,coordinator'],
            'items.*.visitable_id' => ['required', 'integer'],
            'items.*.school_id' => ['required', 'exists:schools,id'],
            'items.*.classification_id' => ['nullable', 'exists:teacher_classifications,id'],
            'items.*.planned_visits' => ['required', 'integer', 'min:0', 'max:99'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }
}
