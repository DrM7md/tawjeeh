<?php

namespace App\Http\Controllers;

use App\Exports\SchoolTemplateExport;
use App\Models\ImportBatch;
use App\Services\ImportService;
use App\Support\ActiveContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ImportController extends Controller
{
    public function __construct(private readonly ImportService $service) {}

    public function index(): Response
    {
        return Inertia::render('import/index', [
            'batches' => ImportBatch::with('user:id,name')->withCount('errors')->latest()->limit(20)->get(),
            'templateHeaders' => $this->service->templateHeaders(),
        ]);
    }

    public function preview(Request $request, ActiveContext $context): Response|RedirectResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240']]);

        if (! $context->isEditable()) {
            return back()->with('error', 'لا يمكن الاستيراد إلا في العام الدراسي النشط');
        }

        $path = $request->file('file')->store('imports');
        $rows = $this->service->parse(Storage::path($path));

        return Inertia::render('import/index', [
            'batches' => ImportBatch::with('user:id,name')->withCount('errors')->latest()->limit(20)->get(),
            'templateHeaders' => $this->service->templateHeaders(),
            'preview' => $this->service->preview($rows),
            'token' => $path,
            'originalName' => $request->file('file')->getClientOriginalName(),
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

        return redirect()->route('import.index')->with(
            'success',
            "اكتمل الاستيراد: {$batch->imported_rows} جديد، {$batch->updated_rows} محدّث، {$batch->failed_rows} فاشل"
        );
    }

    public function template(): BinaryFileResponse
    {
        return Excel::download(new SchoolTemplateExport, 'قالب_استيراد_المدارس.xlsx');
    }

    public function showErrors(ImportBatch $batch): Response
    {
        return Inertia::render('import/index', [
            'batches' => ImportBatch::with('user:id,name')->withCount('errors')->latest()->limit(20)->get(),
            'templateHeaders' => $this->service->templateHeaders(),
            'batchErrors' => [
                'batch' => $batch->only(['id', 'original_filename']),
                'errors' => $batch->errors()->get(['row_number', 'column', 'message', 'raw_data']),
            ],
        ]);
    }
}
