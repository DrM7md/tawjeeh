<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ResolvesDrilldown;
use App\Models\ClassificationRecord;
use App\Models\Department;
use App\Models\Teacher;
use App\Services\ClassificationService;
use App\Support\Permissions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * محرك التصنيف ومتطلبات المتابعة (القسم 1.1):
 * لوحة الالتزام (المطلوب مقابل المنفّذ) + تصنيف معلم (درجة ⇒ فئة آلية) + اعتماد رئيس القسم.
 *
 * شاشة متعددة المستويات حسب الدور:
 *  - رئيس التوجيه/المساعد: الأقسام ← الموجهون ← لوحة موجّه.
 *  - رئيس القسم: موجهو قسمه ← لوحة موجّه.
 *  - الموجه: لوحته مباشرة.
 */
class ClassificationController extends Controller
{
    use ResolvesDrilldown;

    public function __construct(private readonly ClassificationService $service) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $canAll = $user->isSuper() || $user->isLevel(1);
        $canDept = $user->hasRole(Permissions::ROLE_DEPARTMENT_HEAD);

        $nav = $this->resolveDrilldown($request, $user, $canAll, $canDept);

        // المستوى الأول: الأقسام (رئيس التوجيه فقط).
        if ($nav['level'] === 'departments') {
            return Inertia::render('classification/index', [
                'view' => 'departments',
                'departments' => $this->service->departmentBoards(),
            ]);
        }

        // المستوى الثاني: موجهو قسم محدد.
        if ($nav['level'] === 'supervisors') {
            $department = Department::findOrFail($nav['departmentId']);

            return Inertia::render('classification/index', [
                'view' => 'supervisors',
                'department' => ['id' => $department->id, 'name' => $department->name],
                'supervisors' => $this->service->supervisorBoards($department->id),
                'canDrillDepartments' => $canAll,
            ]);
        }

        // المستوى الثالث: لوحة موجّه (أو لوحة المستخدم نفسه).
        $supervisor = $nav['supervisor'];
        $isSelf = $supervisor && $supervisor->id === $user->id;
        $department = $nav['departmentId'] ? Department::find($nav['departmentId']) : null;

        return Inertia::render('classification/index', [
            'view' => 'dashboard',
            'dashboard' => $this->service->dashboard($user, $nav['departmentId'], $isSelf ? null : $supervisor?->id),
            'rules' => $this->service->rules()->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'color' => $r->color,
                'min_percent' => $r->min_percent,
                'max_percent' => $r->max_percent,
                'required_visits' => $r->required_visits,
                'required_forms' => $r->required_forms,
                'is_default_for_new' => $r->is_default_for_new,
            ])->values(),
            'can' => [
                'classify' => $user->can('classification.classify'),
                'approve' => $user->can('classification.approve'),
            ],
            'supervisor' => $isSelf || ! $supervisor ? null : ['id' => $supervisor->id, 'name' => $supervisor->name],
            'department' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
            'canDrillDepartments' => $canAll,
            'canDrillSupervisors' => $canAll || $canDept,
        ]);
    }

    public function classify(Request $request): RedirectResponse
    {
        abort_unless($request->user()->can('classification.classify'), 403);

        $data = $request->validate([
            'teacher_id' => ['required', 'integer', 'exists:teachers,id'],
            'stage' => ['required', 'in:'.implode(',', ClassificationRecord::STAGES)],
            'basis' => ['required', 'in:'.implode(',', ClassificationRecord::BASES)],
            'score' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_new' => ['boolean'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $teacher = Teacher::findOrFail($data['teacher_id']);
        $autoApprove = $request->user()->can('classification.approve');

        $record = $this->service->classify($teacher, [
            'stage' => $data['stage'],
            'basis' => $data['basis'],
            'score' => $data['score'] ?? null,
            'is_new' => (bool) ($data['is_new'] ?? false),
            'note' => $data['note'] ?? null,
        ], $request->user(), $autoApprove);

        $category = $record->classification?->name ?? '—';
        $msg = $autoApprove
            ? "تم التصنيف واعتماده: «{$teacher->name}» ← {$category}"
            : "تم تسجيل التصنيف: «{$teacher->name}» ← {$category} (بانتظار اعتماد رئيس القسم)";

        return back()->with('success', $msg);
    }

    public function approve(Request $request, ClassificationRecord $record): RedirectResponse
    {
        abort_unless($request->user()->can('classification.approve'), 403);

        if ($record->isApproved()) {
            return back()->with('error', 'هذا التصنيف معتمَد بالفعل');
        }

        $this->service->approve($record, $request->user());

        return back()->with('success', 'تم اعتماد التصنيف وتطبيقه');
    }
}
