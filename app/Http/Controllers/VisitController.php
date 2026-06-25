<?php

namespace App\Http\Controllers;

use App\Models\Coordinator;
use App\Models\Department;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\Visit;
use App\Services\VisitService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class VisitController extends Controller
{
    /** محاور التقييم الافتراضية للاستمارة. */
    public const AXES = ['التخطيط للدرس', 'إدارة الصف', 'استراتيجيات التدريس', 'التقويم', 'البيئة الصفية'];

    public function __construct(private readonly VisitService $service) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $departmentId = $request->integer('department') ?: null;

        $departments = ($user->isSuper() || $user->hasPermission('visits.view.all'))
            ? Department::orderBy('name')->get(['id', 'name'])
            : Department::where('id', $user->department_id)->get(['id', 'name']);

        return Inertia::render('visits/index', [
            'followUp' => $this->service->followUp($user, $departmentId),
            'visits' => $this->service->list($user),
            'departments' => $departments,
            'selectedDepartmentId' => $departmentId,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'visit_type' => ['required', Rule::in(['teacher', 'coordinator'])],
            'visitable_id' => ['required', 'integer'],
            'visit_date' => ['required', 'date'],
        ]);

        $target = $data['visit_type'] === 'teacher'
            ? Teacher::find($data['visitable_id'])
            : Coordinator::find($data['visitable_id']);

        abort_unless($target, 404);
        $this->authorizeTarget($request, $target);

        $visit = $this->service->record([
            'visit_type' => $data['visit_type'],
            'visitable_id' => $target->id,
            'school_id' => $target->school_id,
            'department_id' => $target->department_id,
            'visit_date' => $data['visit_date'],
        ]);

        return redirect()->route('visits.show', $visit)->with('success', 'تم تسجيل الزيارة — أكمل الاستمارة');
    }

    public function show(Request $request, Visit $visit): Response
    {
        $this->authorizeView($request, $visit);
        $visit->load(['school:id,name', 'department:id,name', 'visitable', 'supervisor:id,name', 'form.files']);

        return Inertia::render('visits/show', [
            'visit' => $visit,
            'defaultAxes' => self::AXES,
            'canFinalize' => $request->user()->hasPermission('forms.finalize'),
        ]);
    }

    public function destroy(Request $request, Visit $visit): RedirectResponse
    {
        $this->authorizeView($request, $visit);
        $visit->delete();

        return redirect()->route('visits.index')->with('success', 'تم حذف الزيارة');
    }

    /** الموجه يسجّل فقط لمدارسه المكلّف بها. */
    private function authorizeTarget(Request $request, $target): void
    {
        $user = $request->user();
        if ($user->isSuper() || $user->hasPermission('visits.view.all')) {
            return;
        }
        if ($user->hasPermission('visits.view.department') && $user->department_id === $target->department_id) {
            return;
        }
        $assigned = SchoolAssignment::where('supervisor_id', $user->id)->where('school_id', $target->school_id)->exists();
        abort_unless($assigned, 403, 'هذه المدرسة ليست ضمن مدارسك');
    }

    private function authorizeView(Request $request, Visit $visit): void
    {
        $user = $request->user();
        $ok = $user->isSuper()
            || $user->hasPermission('visits.view.all')
            || ($user->hasPermission('visits.view.department') && $visit->department_id === $user->department_id)
            || $visit->supervisor_id === $user->id;
        abort_unless($ok, 403);
    }
}
