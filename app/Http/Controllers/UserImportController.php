<?php

namespace App\Http\Controllers;

use App\Exports\UsersDataExport;
use App\Exports\UsersTemplateExport;
use App\Models\Department;
use App\Models\Role;
use App\Services\Import\UserImportService;
use App\Services\UserService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** استيراد/تصدير المستخدمين (على مستوى صفحة قائمة المستخدمين). */
class UserImportController extends Controller
{
    public function __construct(
        private readonly UserImportService $service,
        private readonly UserService $users,
    ) {}

    public function template(): BinaryFileResponse
    {
        return Excel::download(new UsersTemplateExport, 'قالب_استيراد_الموجهين.xlsx');
    }

    public function export(Request $request): BinaryFileResponse
    {
        $users = $this->users->list($request->user());

        // تصفية حسب التبويب المحدّد: قسم بعينه، أو غير المُسنَدين، أو الكل.
        $tab = (string) $request->query('department', 'all');
        $suffix = '';

        if ($tab === '__none__') {
            $users = $users->whereNull('department_id')->values();
            $suffix = '_إدارة_التوجيه';
        } elseif ($tab !== '' && $tab !== 'all' && ctype_digit($tab)) {
            $users = $users->where('department_id', (int) $tab)->values();
            $suffix = '_'.str_replace(' ', '_', (string) ($users->first()?->department?->name ?? $tab));
        }

        return Excel::download(
            new UsersDataExport($users),
            "كشف_المستخدمين{$suffix}.xlsx",
        );
    }

    public function preview(Request $request): Response|RedirectResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240']]);

        $path = $request->file('file')->store('imports');
        $rows = $this->service->parse(Storage::path($path));

        return Inertia::render('organization/users/index', [
            ...$this->pageProps($request),
            'userImport' => [
                'preview' => $this->service->preview($rows),
                'token' => $path,
                'originalName' => $request->file('file')->getClientOriginalName(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'original_name' => ['nullable', 'string'],
        ]);

        if (! Storage::exists($data['token'])) {
            return back()->with('error', 'انتهت صلاحية الملف المرفوع، أعد الرفع');
        }

        $rows = $this->service->parse(Storage::path($data['token']));
        $batch = $this->service->import($rows, $data['original_name'] ?? 'import.xlsx', $request->user()->id);

        Storage::delete($data['token']);

        return redirect()->route('users.index')->with(
            'success',
            "اكتمل استيراد الموجّهين: {$batch->imported_rows} جديد، {$batch->updated_rows} محدّث، {$batch->failed_rows} فاشل",
        );
    }

    /** خصائص صفحة المستخدمين المشتركة (لإعادة العرض بعد المعاينة). */
    private function pageProps(Request $request): array
    {
        $viewer = $request->user();

        return [
            'users' => $this->users->list($viewer),
            'departments' => Department::orderBy('name')->get(['id', 'name']),
            'roles' => Role::orderBy('level')->get(['id', 'display_name', 'level']),
            'canViewAllDepartments' => $this->users->canViewAll($viewer),
        ];
    }
}
