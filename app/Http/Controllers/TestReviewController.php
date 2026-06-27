<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Grade;
use App\Models\School;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\TestReview;
use App\Models\TestReviewFile;
use App\Models\User;
use App\Notifications\NotificationType;
use App\Services\NotificationDispatcher;
use App\Services\TestReviewService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TestReviewController extends Controller
{
    public function __construct(
        private readonly TestReviewService $service,
        private readonly NotificationDispatcher $notifications,
    ) {}

    /**
     * شاشة التحكيم متعددة المستويات حسب الدور:
     *  - رئيس التوجيه: الأقسام ← الموجهون ← تحكيمات الموجّه.
     *  - رئيس القسم: الموجهون (في قسمه) ← تحكيمات الموجّه.
     *  - الموجه: تحكيماته مباشرة.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $canAll = $user->isSuper() || $user->hasPermission('reviews.view.all');
        $canDept = $user->hasPermission('reviews.view.department');

        // الموجه العادي: تحكيماته مباشرة.
        if (! $canAll && ! $canDept) {
            return $this->reviewsLevel($user, null);
        }

        $supervisorId = $request->integer('supervisor') ?: null;
        // رئيس القسم مقيّد بقسمه؛ رئيس التوجيه يختار القسم.
        $departmentId = $user->department_id;
        if ($canAll) {
            $departmentId = $request->integer('department') ?: null;
        }

        // المستوى الثالث: تحكيمات موجّه محدد.
        if ($supervisorId) {
            $supervisor = User::findOrFail($supervisorId);
            $this->authorizeSupervisor($user, $supervisor, $canAll);

            return $this->reviewsLevel($user, $supervisor);
        }

        // المستوى الثاني: موجهو قسم محدد.
        if ($departmentId) {
            $department = Department::findOrFail($departmentId);

            return Inertia::render('reviews/index', [
                'mode' => 'supervisors',
                'department' => ['id' => $department->id, 'name' => $department->name],
                'supervisors' => $this->service->supervisorBoards($department->id),
                'canDrillDepartments' => $canAll,
            ]);
        }

        // المستوى الأول: الأقسام (رئيس التوجيه فقط).
        return Inertia::render('reviews/index', [
            'mode' => 'departments',
            'departments' => $this->service->departmentBoards(),
        ]);
    }

    /** المستوى الأخير: قائمة تحكيمات موجّه محدد (أو للمستخدم نفسه) + بيانات نموذج «تحكيم جديد». */
    private function reviewsLevel(User $viewer, ?User $supervisor): Response
    {
        // عند عرض موجّه بعينه تُقصَر المدارس على مدارسه المكلّف بها (لتُحسب التغطية بدقّة)
        $schools = $supervisor
            ? $this->schoolsForSupervisor($supervisor->id)
            : $this->schoolsFor($viewer);

        return Inertia::render('reviews/index', [
            'mode' => 'reviews',
            'selectedSupervisor' => $supervisor
                ? ['id' => $supervisor->id, 'name' => $supervisor->name, 'department_id' => $supervisor->department_id]
                : null,
            'canDrillDepartments' => $viewer->isSuper() || $viewer->hasPermission('reviews.view.all'),
            'reviews' => $this->service->list($viewer, $supervisor?->id),
            // مرحلة المدرسة تُشتقّ تلقائيًا عند الاختيار — مقصورة على المدارس المتاحة
            'schools' => $schools,
            // الصفوف مع مرحلتها ومساراتها — تُصفّى في الواجهة حسب مرحلة المدرسة
            'grades' => Grade::with('tracks:id,grade_id,name')->orderBy('sort_order')->get(['id', 'stage_id', 'name']),
            // معلمو المدارس المتاحة — تُصفّى في الواجهة حسب (المدرسة + المادة) لاختيار معد الاختبار
            'teachers' => $this->teachersForSchools($schools->pluck('id')),
            // المادة ثابتة من قسم الموجّه؛ والقائمة تُستخدم فقط لمن لا قسم له (مدير/مشرف عام)
            'userDepartment' => $viewer->department_id ? $viewer->department()->first(['id', 'name']) : null,
            'departments' => $viewer->department_id ? [] : Department::orderBy('name')->get(['id', 'name']),
        ]);
    }

    /** رئيس القسم لا يرى إلا موجهي قسمه؛ رئيس التوجيه يرى الجميع. */
    private function authorizeSupervisor(User $viewer, User $supervisor, bool $canAll): void
    {
        if ($canAll) {
            return;
        }

        abort_unless(
            $viewer->hasPermission('reviews.view.department') && $supervisor->department_id === $viewer->department_id,
            403,
        );
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'school_id' => ['required', 'exists:schools,id'],
            'department_id' => [Rule::requiredIf(! $user->department_id), 'nullable', 'exists:departments,id'],
            'grade_id' => ['nullable', 'exists:grades,id'],
            'grade_track_id' => ['nullable', 'exists:grade_tracks,id'],
            'preparer_id' => ['nullable', 'exists:teachers,id'],
            'exam_period' => ['required', Rule::in(['mid_first', 'final_first', 'mid_second', 'final_second'])],
            'reviewed_at' => ['nullable', 'date'],
        ]);

        // المادة من قسم الموجّه (إن وُجد)، والمرحلة من مرحلة المدرسة المختارة
        $data['department_id'] = $user->department_id ?: $data['department_id'];
        $data['stage_id'] = School::whereKey($data['school_id'])->value('stage_id');

        // معد الاختبار يجب أن يكون معلّمًا في المدرسة المختارة وضمن نفس المادة، وإلا يُهمَل
        if (! empty($data['preparer_id'])) {
            $valid = Teacher::whereKey($data['preparer_id'])
                ->where('school_id', $data['school_id'])
                ->where('department_id', $data['department_id'])
                ->exists();
            if (! $valid) {
                $data['preparer_id'] = null;
            }
        }

        // المسار يجب أن يخصّ الصف المختار، وإلا يُهمَل
        if (! empty($data['grade_track_id'])) {
            $belongs = Grade::whereKey($data['grade_id'])
                ->whereHas('tracks', fn ($q) => $q->whereKey($data['grade_track_id']))->exists();
            if (! $belongs) {
                $data['grade_track_id'] = null;
            }
        }

        $review = $this->service->create($data);

        $schoolName = School::whereKey($data['school_id'])->value('name');
        $this->notifications->send(
            NotificationType::REVIEW_ASSIGNED,
            [
                'title' => 'تحكيم اختبار جديد',
                'message' => "أنشأ {$user->name} سجل تحكيم اختبار — {$schoolName}",
                'url' => route('reviews.show', $review),
            ],
            departmentId: $review->department_id,
            excludeUserId: $user->id,
        );

        return redirect()->route('reviews.show', $review)->with('success', 'تم إنشاء سجل التحكيم — أكمل المعايير');
    }

    public function show(Request $request, TestReview $testReview): Response
    {
        $this->authorizeView($request, $testReview);
        $testReview->load([
            'school:id,name', 'department:id,name', 'stage:id,name', 'supervisor:id,name',
            'grade:id,name', 'track:id,name', 'preparer:id,name', 'form', 'files:id,test_review_id,original_name,size,mime',
        ]);

        return Inertia::render('reviews/show', [
            'review' => $testReview,
            'domains' => $this->service->formStructure(),
            'canFinalize' => $request->user()->hasPermission('reviews.finalize'),
            'canEdit' => $request->user()->hasPermission('reviews.create'),
        ]);
    }

    /** نسخة قابلة للطباعة تطابق تخطيط الاستمارة الرسمية (تُفتح في تبويب جديد). */
    public function printForm(Request $request, TestReview $testReview): Response
    {
        $this->authorizeView($request, $testReview);
        $testReview->load([
            'school:id,name,gender', 'department:id,name', 'stage:id,name', 'supervisor:id,name',
            'grade:id,name', 'track:id,name', 'preparer:id,name', 'form', 'academicYear:id,name',
        ]);

        return Inertia::render('reviews/form-print', [
            'review' => $testReview,
            'domains' => $this->service->formStructure(),
        ]);
    }

    public function saveForm(Request $request, TestReview $testReview): RedirectResponse
    {
        $this->authorizeView($request, $testReview);

        $data = $request->validate([
            'criteria' => ['nullable', 'array'],
            'criteria.*.indicator_id' => ['nullable', 'integer', 'exists:review_indicators,id'],
            'criteria.*.notes' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'result' => ['nullable', 'string', 'max:100'],
            'status' => ['required', Rule::in(['draft', 'final'])],
        ]);

        if ($data['status'] === 'final') {
            abort_unless($request->user()->hasPermission('reviews.finalize'), 403);
        }
        if ($testReview->status === 'final' && ! $request->user()->hasPermission('reviews.finalize')) {
            return back()->with('error', 'سجل التحكيم معتمد ولا يمكن تعديله');
        }

        $this->service->saveForm($testReview, $data, $data['status']);

        // بعد الحفظ نرجع لقائمة التحكيمات (لا نبقى في صفحة السجل)
        return redirect()->route('reviews.index')
            ->with('success', $data['status'] === 'final' ? 'تم اعتماد التحكيم' : 'تم حفظ المسودة');
    }

    public function uploadFile(Request $request, TestReview $testReview): RedirectResponse
    {
        $this->authorizeView($request, $testReview);
        $request->validate(['file' => ['required', 'file', 'max:10240']]);

        $this->service->addFile($testReview, $request->file('file'));

        return back()->with('success', 'تم رفع استمارة التحكيم');
    }

    public function destroyFile(Request $request, TestReviewFile $file): RedirectResponse
    {
        $this->authorizeView($request, $file->review);
        $this->service->deleteFile($file);

        return back()->with('success', 'تم حذف المرفق');
    }

    public function downloadFile(Request $request, TestReviewFile $file): StreamedResponse
    {
        $this->authorizeView($request, $file->review);
        abort_unless(Storage::disk('local')->exists($file->path), 404);

        return Storage::disk('local')->download($file->path, $file->original_name);
    }

    public function destroy(Request $request, TestReview $testReview): RedirectResponse
    {
        $this->authorizeView($request, $testReview);
        $this->service->delete($testReview);

        return redirect()->route('reviews.index')->with('success', 'تم حذف سجل التحكيم');
    }

    /**
     * مدارس نموذج «تحكيم جديد»: الموجّه يرى مدارسه المكلّف بها فقط؛
     * رئيس القسم يرى مدارس قسمه؛ المشرف العام يرى كل المدارس النشطة.
     */
    private function schoolsFor(User $user): Collection
    {
        $query = School::where('is_active', true)->orderBy('name')->with('stage:id,name');

        if (! ($user->isSuper() || $user->hasPermission('reviews.view.all'))) {
            $assignments = SchoolAssignment::query();
            if ($user->hasPermission('reviews.view.department') && $user->department_id) {
                $assignments->where('department_id', $user->department_id);
            } else {
                $assignments->where('supervisor_id', $user->id);
            }
            $query->whereIn('id', $assignments->pluck('school_id'));
        }

        return $query->get(['id', 'name', 'stage_id']);
    }

    /** مدارس موجّه بعينه المكلّف بها — لحساب التغطية وعرض نموذج التحكيم عند الدخول عليه. */
    private function schoolsForSupervisor(int $supervisorId): Collection
    {
        $schoolIds = SchoolAssignment::where('supervisor_id', $supervisorId)->pluck('school_id');

        return School::whereIn('id', $schoolIds)->where('is_active', true)
            ->orderBy('name')->with('stage:id,name')
            ->get(['id', 'name', 'stage_id']);
    }

    /**
     * معلمو مجموعة مدارس لاختيار «معد الاختبار» — تُصفّى في الواجهة حسب (المدرسة + المادة).
     */
    private function teachersForSchools(Collection $schoolIds): Collection
    {
        return Teacher::active()
            ->whereIn('school_id', $schoolIds)
            ->orderBy('name')
            ->get(['id', 'name', 'school_id', 'department_id']);
    }

    private function authorizeView(Request $request, TestReview $review): void
    {
        $user = $request->user();
        $ok = $user->isSuper()
            || $user->hasPermission('reviews.view.all')
            || ($user->hasPermission('reviews.view.department') && $review->department_id === $user->department_id)
            || $review->supervisor_id === $user->id;
        abort_unless($ok, 403);
    }
}
