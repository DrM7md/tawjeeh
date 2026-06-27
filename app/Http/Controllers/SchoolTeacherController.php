<?php

namespace App\Http\Controllers;

use App\Exports\TeachersDataExport;
use App\Exports\TeachersTemplateExport;
use App\Models\School;
use App\Models\Teacher;
use App\Services\Import\TeacherImportService;
use App\Services\SchoolPagePresenter;
use App\Services\TeacherProfileService;
use App\Support\ActiveContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** استيراد/تصدير معلمي القسم وإدارة صفوفهم — داخل صفحة المدرسة (الموجه). */
class SchoolTeacherController extends Controller
{
    public function __construct(
        private readonly TeacherImportService $service,
        private readonly SchoolPagePresenter $presenter,
    ) {}

    /** الملف الشخصي للمعلم: بياناته + سجل زياراته ومستواه عبر الأعوام. */
    public function show(School $school, Teacher $teacher, TeacherProfileService $profile): Response
    {
        abort_unless($teacher->school_id === $school->id, 404);

        return Inertia::render('organization/schools/teacher-profile', $profile->props($school, $teacher));
    }

    public function template(School $school, Request $request, ActiveContext $context): BinaryFileResponse
    {
        $dept = $this->presenter->resolveDepartment($request->user(), $school, $request->integer('department') ?: null);

        return Excel::download(
            new TeachersTemplateExport($school->name, $dept?->name, $context->selectedYear()?->name),
            'قالب_استيراد_المعلمين.xlsx',
        );
    }

    public function export(School $school, Request $request, ActiveContext $context): BinaryFileResponse
    {
        $dept = $this->presenter->resolveDepartment($request->user(), $school, $request->integer('department') ?: null);

        $teachers = Teacher::where('school_id', $school->id)
            ->where('is_active', true)
            ->when($dept, fn ($q) => $q->where('department_id', $dept->id))
            ->with('grades:id,name')
            ->orderBy('name')
            ->get();

        return Excel::download(
            new TeachersDataExport($teachers, $school->name, $dept?->name, $context->selectedYear()?->name),
            'كشف_المعلمين.xlsx',
        );
    }

    public function preview(Request $request, School $school, ActiveContext $context): Response|RedirectResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240']]);

        $dept = $this->authorizeImport($request, $school, $context);

        $path = $request->file('file')->store('imports');
        $rows = $this->service->parse(Storage::path($path));

        return Inertia::render('organization/schools/show', $this->presenter->props($school, $request->user(), [
            'teacherImport' => [
                'preview' => $this->service->preview($rows, $school, $dept->id),
                'token' => $path,
                'originalName' => $request->file('file')->getClientOriginalName(),
                'department_id' => $dept->id,
            ],
        ]));
    }

    public function store(Request $request, School $school, ActiveContext $context): RedirectResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'original_name' => ['nullable', 'string'],
        ]);

        $dept = $this->authorizeImport($request, $school, $context);

        if (! Storage::exists($data['token'])) {
            return back()->with('error', 'انتهت صلاحية الملف المرفوع، أعد الرفع');
        }

        $rows = $this->service->parse(Storage::path($data['token']));
        $batch = $this->service->import($rows, $school, $dept->id, $data['original_name'] ?? 'import.xlsx', $request->user()->id);

        Storage::delete($data['token']);

        $deactivated = $batch->summary['deactivated'] ?? 0;

        return redirect()->route('schools.show', $school)->with(
            'success',
            "اكتمل استيراد المعلمين: {$batch->imported_rows} جديد، {$batch->updated_rows} محدّث، {$deactivated} مُعطَّل، {$batch->failed_rows} فاشل",
        );
    }

    public function updateGrades(Request $request, School $school, Teacher $teacher): RedirectResponse
    {
        abort_unless($teacher->school_id === $school->id, 404);

        $data = $request->validate([
            'grade_ids' => ['array'],
            'grade_ids.*' => ['integer', 'exists:grades,id'],
        ]);

        $teacher->grades()->sync($data['grade_ids'] ?? []);

        return back()->with('success', 'تم تحديث صفوف المعلم');
    }

    /** يتحقق من قابلية التعديل والإسناد، ويعيد قسم العرض. */
    private function authorizeImport(Request $request, School $school, ActiveContext $context): \App\Models\Department
    {
        if (! $context->isEditable()) {
            abort(403, 'لا يمكن الاستيراد إلا في العام الدراسي النشط');
        }

        $user = $request->user();
        $dept = $this->presenter->resolveDepartment($user, $school, $request->integer('department') ?: null);
        abort_if($dept === null, 422, 'لا يوجد قسم محدّد للاستيراد');

        $allowed = $user->can('schools.manage') || $this->presenter->isAssigned($user, $school, $dept->id);
        abort_unless($allowed, 403, 'هذه المدرسة غير مُسندة إليك');

        return $dept;
    }
}
