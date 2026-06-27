<?php

namespace App\Http\Controllers;

use App\Exports\RosterTemplateExport;
use App\Models\Department;
use App\Models\ImportBatch;
use App\Models\School;
use App\Models\TeacherClassification;
use App\Services\Import\RosterImportService;
use App\Support\ActiveContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * استيراد «كشف المعلمين»: قالب يشير لمدارس موجودة فقط، يقرأ التقييم السنوي ويشتقّ التصنيف،
 * ويحدّد المنسقين — مقيّد بقسم واحد (قسم رافع الملف). منفصل عن استيراد المدارس.
 */
class RosterImportController extends Controller
{
    public function __construct(private readonly RosterImportService $service) {}

    public function index(Request $request): Response
    {
        return Inertia::render('import/index', array_merge($this->pageProps($request), [
            'preview' => $request->session()->get('preview'),
            'token' => $request->session()->get('token'),
            'originalName' => $request->session()->get('originalName'),
            'selectedDepartmentId' => $request->session()->get('selectedDepartmentId'),
        ]));
    }

    /** قالب الكشف (روط roster-import/template) — نفس قالب صفحة المدارس. */
    public function template(Request $request, ActiveContext $context): BinaryFileResponse
    {
        return $this->downloadTemplate($request, $context);
    }

    public function rosterTemplate(Request $request, ActiveContext $context): BinaryFileResponse
    {
        return $this->downloadTemplate($request, $context);
    }

    public function preview(Request $request, ActiveContext $context): RedirectResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240']]);

        if (! $context->isEditable()) {
            return back()->with('error', 'لا يمكن الاستيراد إلا في العام الدراسي النشط');
        }

        $departmentId = $this->resolveDepartment($request);
        $path = $request->file('file')->store('imports');
        $rows = $this->service->parse(Storage::path($path));

        // POST‑redirect‑GET: نمرّر المعاينة عبر الجلسة ونعيد التوجيه (303) كي يبقى المسار GET آمنًا.
        return redirect()->route('roster-import.index', [], 303)->with([
            'preview' => $this->service->preview($rows, $departmentId),
            'token' => $path,
            'originalName' => $request->file('file')->getClientOriginalName(),
            'selectedDepartmentId' => $departmentId,
        ]);
    }

    public function store(Request $request, ActiveContext $context): RedirectResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'original_name' => ['nullable', 'string'],
        ]);

        if (! $context->isEditable()) {
            return back()->with('error', 'لا يمكن الاستيراد إلا في العام الدراسي النشط');
        }

        if (! Storage::exists($data['token'])) {
            return back()->with('error', 'انتهت صلاحية الملف المرفوع، أعد الرفع');
        }

        $departmentId = $this->resolveDepartment($request);
        $rows = $this->service->parse(Storage::path($data['token']));
        $batch = $this->service->import($rows, $departmentId, $data['original_name'] ?? 'roster.xlsx', $request->user());

        Storage::delete($data['token']);

        $s = $batch->summary;

        return redirect()->route('roster-import.index')->with(
            'success',
            "اكتمل استيراد الكشف: {$batch->imported_rows} معلم جديد، {$batch->updated_rows} محدّث، {$s['classified']} مُصنّف، {$s['coordinators']} منسق، {$s['deactivated']} مُعطَّل، {$batch->failed_rows} فاشل",
        );
    }

    public function showErrors(Request $request, ImportBatch $batch): Response
    {
        return Inertia::render('import/index', array_merge($this->pageProps($request), [
            'batchErrors' => [
                'batch' => $batch->only(['id', 'original_filename']),
                'errors' => $batch->errors()->get(['row_number', 'message', 'raw_data']),
            ],
        ]));
    }

    /* ===================== مساعدات ===================== */

    private function pageProps(Request $request): array
    {
        $user = $request->user();
        $locked = $user->department_id && ! $user->isSuper();

        return [
            'batches' => ImportBatch::where('type', 'roster')
                ->with('user:id,name')->withCount('errors')->latest()->limit(15)->get(),
            'department' => $locked ? ['id' => $user->department_id, 'name' => $user->department?->name] : null,
            'departments' => $locked ? [] : Department::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ];
    }

    /** قسم الاستيراد: رئيس القسم مقيّد بقسمه؛ الإدارة العليا تختار قسمًا. */
    private function resolveDepartment(Request $request): int
    {
        $user = $request->user();
        if ($user->department_id && ! $user->isSuper()) {
            return (int) $user->department_id;
        }

        $deptId = $request->integer('department_id');
        abort_unless($deptId && Department::whereKey($deptId)->exists(), 422, 'يجب تحديد القسم للاستيراد');

        return $deptId;
    }

    private function downloadTemplate(Request $request, ActiveContext $context): BinaryFileResponse
    {
        $schools = School::where('is_active', true)->orderBy('name')->pluck('name')->all();

        // قواعد التصنيف مرتّبة تصاعديًا حسب الحدّ الأدنى — لبناء معادلة التصنيف التلقائي في القالب.
        $rules = TeacherClassification::orderBy('min_percent')->get(['name', 'max_percent'])
            ->map(fn ($c) => ['name' => $c->name, 'max' => (int) ($c->max_percent ?? 100)])
            ->all();

        return Excel::download(
            new RosterTemplateExport(
                $schools,
                $request->user()->department?->name,
                $rules,
                $context->selectedYear()?->name,
            ),
            'قالب_كشف_المعلمين.xlsx',
        );
    }
}
