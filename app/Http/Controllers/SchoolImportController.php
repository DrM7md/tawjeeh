<?php

namespace App\Http\Controllers;

use App\Exports\SchoolsDataExport;
use App\Exports\SchoolsTemplateExport;
use App\Models\Stage;
use App\Services\Import\SchoolImportService;
use App\Services\SchoolService;
use App\Support\ActiveContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** استيراد/تصدير المدارس (على مستوى صفحة قائمة المدارس). */
class SchoolImportController extends Controller
{
    public function __construct(
        private readonly SchoolImportService $service,
        private readonly SchoolService $schools,
    ) {}

    public function template(ActiveContext $context): BinaryFileResponse
    {
        return Excel::download(new SchoolsTemplateExport($context->selectedYear()?->name), 'قالب_استيراد_المدارس.xlsx');
    }

    public function export(ActiveContext $context): BinaryFileResponse
    {
        return Excel::download(
            new SchoolsDataExport($this->schools->list(), $context->selectedYear()?->name),
            'كشف_المدارس.xlsx',
        );
    }

    public function preview(Request $request, ActiveContext $context): Response|RedirectResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240']]);

        if (! $context->isEditable()) {
            return back()->with('error', 'لا يمكن الاستيراد إلا في العام الدراسي النشط');
        }

        $path = $request->file('file')->store('imports');
        $rows = $this->service->parse(Storage::path($path));

        return Inertia::render('organization/schools/index', [
            'schools' => $this->schools->list(),
            'stages' => Stage::orderBy('sort_order')->get(['id', 'name']),
            'schoolImport' => [
                'preview' => $this->service->preview($rows),
                'token' => $path,
                'originalName' => $request->file('file')->getClientOriginalName(),
            ],
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

        $rows = $this->service->parse(Storage::path($data['token']));
        $batch = $this->service->import($rows, $data['original_name'] ?? 'import.xlsx', $request->user()->id);

        Storage::delete($data['token']);

        $deactivated = $batch->summary['deactivated'] ?? 0;

        return redirect()->route('schools.index')->with(
            'success',
            "اكتمل استيراد المدارس: {$batch->imported_rows} جديد، {$batch->updated_rows} محدّث، {$deactivated} عُطّل، {$batch->failed_rows} فاشل",
        );
    }
}
