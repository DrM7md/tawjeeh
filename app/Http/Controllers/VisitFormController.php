<?php

namespace App\Http\Controllers;

use App\Models\Visit;
use App\Models\VisitFile;
use App\Services\VisitFormService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VisitFormController extends Controller
{
    public function __construct(private readonly VisitFormService $service) {}

    public function save(Request $request, Visit $visit): RedirectResponse
    {
        $this->authorizeVisit($request, $visit);

        $data = $request->validate([
            'axes' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
            'recommendations' => ['nullable', 'string'],
            'signature' => ['nullable', 'string'],
            'save_status' => ['required', Rule::in(['draft', 'final'])],
        ]);

        // الاعتماد النهائي يتطلب صلاحية، والاستمارة المعتمدة تُقفل
        if ($data['save_status'] === 'final') {
            abort_unless($request->user()->hasPermission('forms.finalize'), 403);
        }
        if ($visit->form?->isFinal() && ! $request->user()->hasPermission('forms.finalize')) {
            return back()->with('error', 'الاستمارة معتمدة ولا يمكن تعديلها');
        }

        $this->service->save($visit, $data, $data['save_status']);

        return back()->with('success', $data['save_status'] === 'final' ? 'تم اعتماد الاستمارة' : 'تم حفظ المسودة');
    }

    public function uploadFile(Request $request, Visit $visit): RedirectResponse
    {
        $this->authorizeVisit($request, $visit);
        $request->validate(['file' => ['required', 'file', 'max:10240']]);

        $form = $visit->form ?: $this->service->save($visit, [], 'draft');
        $this->service->addFile($form, $request->file('file'));

        return back()->with('success', 'تم رفع المرفق');
    }

    public function destroyFile(Request $request, VisitFile $file): RedirectResponse
    {
        $visit = $file->form->visit;
        $this->authorizeVisit($request, $visit);
        $this->service->deleteFile($file);

        return back()->with('success', 'تم حذف المرفق');
    }

    public function downloadFile(Request $request, VisitFile $file): StreamedResponse
    {
        $this->authorizeVisit($request, $file->form->visit);
        abort_unless(Storage::disk('local')->exists($file->path), 404);

        return Storage::disk('local')->download($file->path, $file->original_name);
    }

    private function authorizeVisit(Request $request, Visit $visit): void
    {
        $user = $request->user();
        $ok = $user->isSuper()
            || $user->hasPermission('visits.view.all')
            || ($user->hasPermission('forms.review') && $visit->department_id === $user->department_id)
            || $visit->supervisor_id === $user->id;
        abort_unless($ok, 403);
    }
}
