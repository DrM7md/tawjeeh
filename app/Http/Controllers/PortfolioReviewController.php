<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ResolvesDrilldown;
use App\Models\CoordinatorAssignment;
use App\Models\Department;
use App\Models\PortfolioReview;
use App\Models\PortfolioReviewScore;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\User;
use App\Notifications\NotificationType;
use App\Services\NotificationDispatcher;
use App\Services\PortfolioReviewService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * تقييم ملفات/حافظة أعمال المنسق وفق قالب بنود مرنة قابلة للضبط من الإعدادات.
 *
 * شاشة متعددة المستويات حسب الدور:
 *  - رئيس التوجيه/المساعد: الأقسام ← الموجهون ← منسّقو موجّه.
 *  - رئيس القسم: موجهو قسمه ← منسّقو موجّه.
 *  - الموجه: منسّقوه مباشرة.
 */
class PortfolioReviewController extends Controller
{
    use ResolvesDrilldown;

    public function __construct(
        private readonly PortfolioReviewService $service,
        private readonly NotificationDispatcher $notifications,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $canAll = $user->isSuper() || $user->hasPermission('portfolios.view.all');
        $canDept = $user->hasPermission('portfolios.view.department');

        $nav = $this->resolveDrilldown($request, $user, $canAll, $canDept);

        // المستوى الأول: الأقسام.
        if ($nav['level'] === 'departments') {
            return Inertia::render('portfolios/index', [
                'view' => 'departments',
                'departments' => $this->service->departmentBoards(),
            ]);
        }

        // المستوى الثاني: موجهو قسم محدد.
        if ($nav['level'] === 'supervisors') {
            $department = Department::findOrFail($nav['departmentId']);

            return Inertia::render('portfolios/index', [
                'view' => 'supervisors',
                'department' => ['id' => $department->id, 'name' => $department->name],
                'supervisors' => $this->service->supervisorBoards($department->id),
                'canDrillDepartments' => $canAll,
            ]);
        }

        // المستوى الثالث: منسّقو موجّه (أو منسّقو المستخدم نفسه).
        $supervisor = $nav['supervisor'];
        $isSelf = $supervisor && $supervisor->id === $user->id;
        $department = $nav['departmentId'] ? Department::find($nav['departmentId']) : null;

        return Inertia::render('portfolios/index', [
            'view' => 'content',
            // المنسّقون المسؤول عنهم (تكاليف تنسيق نشطة) — محصورون بالموجّه إن دخل عليه رئيس
            'coordinators' => $this->coordinatorsFor($user, $isSelf ? null : $supervisor?->id),
            // التقييمات القائمة (الفصلان معًا) — تُدمج في الواجهة مع المنسّقين حسب التاب
            'reviews' => $this->service->list($user, $isSelf ? null : $supervisor?->id),
            // هل يوجد قالب فعّال يمكن البدء به؟
            'hasTemplate' => (bool) $this->service->activeTemplate(),
            'supervisor' => $isSelf || ! $supervisor ? null : ['id' => $supervisor->id, 'name' => $supervisor->name],
            'department' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
            'canDrillSupervisors' => $canAll || $canDept,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'teacher_id' => ['required', 'exists:teachers,id'],
            'term' => ['required', Rule::in(['first', 'second'])],
            'reviewed_at' => ['nullable', 'date'],
        ]);

        $template = $this->service->activeTemplate();
        abort_unless($template, 422, 'لا يوجد قالب تقييم فعّال — أضِف قالبًا من الإعدادات أولًا');
        $data['portfolio_review_template_id'] = $template->id;

        $teacher = Teacher::findOrFail($data['teacher_id']);
        // المادة من قسم الموجّه إن وُجد، وإلا من تكليف التنسيق النشط للمعلم، وإلا قسم المعلم
        $activeAssignment = CoordinatorAssignment::active()->where('teacher_id', $teacher->id)->first();
        $data['department_id'] = $user->department_id ?: ($activeAssignment?->department_id ?: $teacher->department_id);

        $review = $this->service->create($data);

        // إشعار فقط عند الإنشاء الفعلي (لا عند فتح سجل قائم)
        if ($review->wasRecentlyCreated) {
            $this->notifications->send(
                NotificationType::PORTFOLIO_REVIEWED,
                [
                    'title' => 'تقييم ملفات منسق جديد',
                    'message' => "أنشأ {$user->name} سجل تقييم ملفات للمنسق — {$teacher->name}",
                    'url' => route('portfolios.show', $review),
                ],
                departmentId: $review->department_id,
                excludeUserId: $user->id,
            );
        }

        return redirect()->route('portfolios.show', $review)->with('success', 'تم فتح سجل التقييم — أكمل البنود');
    }

    public function show(Request $request, PortfolioReview $portfolioReview): Response
    {
        $this->authorizeView($request, $portfolioReview);
        $portfolioReview->load([
            'coordinator:id,name,school_id,department_id', 'coordinator.school:id,name',
            'department:id,name', 'supervisor:id,name', 'template:id,name',
            'scores' => fn ($q) => $q->orderBy('sort_order'),
        ]);

        return Inertia::render('portfolios/show', [
            'review' => $portfolioReview,
            'canFinalize' => $request->user()->hasPermission('portfolios.finalize'),
            'canEdit' => $request->user()->hasPermission('portfolios.create'),
        ]);
    }

    public function saveForm(Request $request, PortfolioReview $portfolioReview): RedirectResponse
    {
        $this->authorizeView($request, $portfolioReview);

        $data = $request->validate([
            'scores' => ['nullable', 'array'],
            'scores.*.score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'scores.*.note' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['draft', 'final'])],
        ]);

        if ($data['status'] === 'final') {
            abort_unless($request->user()->hasPermission('portfolios.finalize'), 403);
        }
        if ($portfolioReview->status === 'final' && ! $request->user()->hasPermission('portfolios.finalize')) {
            return back()->with('error', 'سجل التقييم معتمد ولا يمكن تعديله');
        }

        $this->service->saveForm($portfolioReview, $data['scores'] ?? [], $data['notes'] ?? null, $data['status']);

        return redirect()->route('portfolios.index')
            ->with('success', $data['status'] === 'final' ? 'تم اعتماد التقييم' : 'تم حفظ المسودة');
    }

    public function uploadAttachment(Request $request, PortfolioReviewScore $score): RedirectResponse
    {
        $this->authorizeView($request, $score->review);
        $request->validate(['file' => ['required', 'file', 'max:10240']]);

        $this->service->addAttachment($score, $request->file('file'));

        return back()->with('success', 'تم رفع المرفق');
    }

    public function destroyAttachment(Request $request, PortfolioReviewScore $score): RedirectResponse
    {
        $this->authorizeView($request, $score->review);
        $this->service->deleteAttachment($score);

        return back()->with('success', 'تم حذف المرفق');
    }

    public function downloadAttachment(Request $request, PortfolioReviewScore $score): StreamedResponse
    {
        $this->authorizeView($request, $score->review);
        abort_unless($score->attachment_path && Storage::disk('local')->exists($score->attachment_path), 404);

        return Storage::disk('local')->download($score->attachment_path, $score->attachment_name);
    }

    public function printReview(Request $request, PortfolioReview $portfolioReview): Response
    {
        $this->authorizeView($request, $portfolioReview);
        $portfolioReview->load([
            'coordinator:id,name,school_id,department_id', 'coordinator.school:id,name',
            'department:id,name', 'supervisor:id,name', 'template:id,name',
            'scores' => fn ($q) => $q->orderBy('sort_order'),
        ]);

        return Inertia::render('portfolios/print', ['review' => $portfolioReview]);
    }

    public function destroy(Request $request, PortfolioReview $portfolioReview): RedirectResponse
    {
        $this->authorizeView($request, $portfolioReview);
        $this->service->delete($portfolioReview);

        return redirect()->route('portfolios.index')->with('success', 'تم حذف سجل التقييم');
    }

    /**
     * منسّقو نموذج «تقييم جديد» = معلمون لهم تكليف تنسيق نشط في العام المختار.
     * الموجّه يرى منسّقي مدارسه المكلّف بها فقط؛ رئيس القسم يرى منسّقي قسمه؛ المشرف العام يرى الكل.
     */
    private function coordinatorsFor(User $user, ?int $supervisorId = null): \Illuminate\Support\Collection
    {
        $query = CoordinatorAssignment::active()
            ->with(['teacher:id,name', 'school:id,name,gender', 'department:id,name'])
            ->orderBy('school_id');

        if ($supervisorId) {
            // دخول رئيس على موجّه بعينه: منسّقو مدارسه المكلّف بها ضمن قسم الموجّه.
            $supervisor = User::find($supervisorId);
            $query->whereIn('school_id', SchoolAssignment::where('supervisor_id', $supervisorId)->pluck('school_id'));
            if ($supervisor?->department_id) {
                $query->where('department_id', $supervisor->department_id);
            }
        } elseif (! ($user->isSuper() || $user->hasPermission('portfolios.view.all'))) {
            if ($user->hasPermission('portfolios.view.department') && $user->department_id) {
                $query->where('department_id', $user->department_id);
            } else {
                $schoolIds = SchoolAssignment::where('supervisor_id', $user->id)->pluck('school_id');
                $query->whereIn('school_id', $schoolIds);
                if ($user->department_id) {
                    $query->where('department_id', $user->department_id);
                }
            }
        }

        $list = $query->get();

        // الموجّه المسؤول عن كل منسق = الموجّه المسنَدة إليه مدرسته في قسمه (من توزيع المدارس)
        $supervisorBySchoolDept = SchoolAssignment::whereIn('school_id', $list->pluck('school_id')->unique())
            ->with('supervisor:id,name')
            ->get()
            ->keyBy(fn (SchoolAssignment $sa) => $sa->school_id.'-'.$sa->department_id);

        return $list->map(fn (CoordinatorAssignment $a) => [
            'teacher_id' => $a->teacher_id,
            'name' => $a->teacher?->name,
            'school' => $a->school?->name,
            'gender' => $a->school?->gender,
            'department' => $a->department?->name,
            'department_id' => $a->department_id,
            'supervisor' => $supervisorBySchoolDept->get($a->school_id.'-'.$a->department_id)?->supervisor?->name,
        ])->values();
    }

    private function authorizeView(Request $request, PortfolioReview $review): void
    {
        $user = $request->user();
        $ok = $user->isSuper()
            || $user->hasPermission('portfolios.view.all')
            || ($user->hasPermission('portfolios.view.department') && $review->department_id === $user->department_id)
            || $review->supervisor_id === $user->id;
        abort_unless($ok, 403);
    }
}
