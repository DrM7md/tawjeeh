<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\School;
use App\Models\Stage;
use App\Models\TestReview;
use App\Services\TestReviewService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TestReviewController extends Controller
{
    /** معايير التحكيم الافتراضية. */
    public const CRITERIA = ['مطابقة جدول المواصفات', 'تنوّع الأسئلة', 'وضوح الصياغة', 'الشمولية', 'مراعاة مستويات بلوم', 'التدرّج في الصعوبة'];

    public function __construct(private readonly TestReviewService $service) {}

    public function index(Request $request): Response
    {
        return Inertia::render('reviews/index', [
            'reviews' => $this->service->list($request->user()),
            'schools' => School::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'departments' => Department::orderBy('name')->get(['id', 'name']),
            'stages' => Stage::orderBy('sort_order')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'school_id' => ['required', 'exists:schools,id'],
            'department_id' => ['required', 'exists:departments,id'],
            'stage_id' => ['nullable', 'exists:stages,id'],
            'grade' => ['nullable', 'string', 'max:100'],
            'reviewed_at' => ['nullable', 'date'],
        ]);

        $review = $this->service->create($data);

        return redirect()->route('reviews.show', $review)->with('success', 'تم إنشاء سجل التحكيم — أكمل المعايير');
    }

    public function show(Request $request, TestReview $testReview): Response
    {
        $this->authorizeView($request, $testReview);
        $testReview->load(['school:id,name', 'department:id,name', 'stage:id,name', 'supervisor:id,name', 'form']);

        return Inertia::render('reviews/show', [
            'review' => $testReview,
            'defaultCriteria' => self::CRITERIA,
            'canFinalize' => $request->user()->hasPermission('reviews.finalize'),
        ]);
    }

    public function saveForm(Request $request, TestReview $testReview): RedirectResponse
    {
        $this->authorizeView($request, $testReview);

        $data = $request->validate([
            'criteria' => ['nullable', 'array'],
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

        return back()->with('success', $data['status'] === 'final' ? 'تم اعتماد التحكيم' : 'تم حفظ المسودة');
    }

    public function destroy(Request $request, TestReview $testReview): RedirectResponse
    {
        $this->authorizeView($request, $testReview);
        $this->service->delete($testReview);

        return redirect()->route('reviews.index')->with('success', 'تم حذف سجل التحكيم');
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
