<?php

namespace App\Http\Controllers;

use App\Services\DistributionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DistributionController extends Controller
{
    public function __construct(private readonly DistributionService $service) {}

    public function index(Request $request): Response
    {
        $departments = $this->service->availableDepartments($request->user());
        $departmentId = $this->resolveDepartment($request, $departments);

        return Inertia::render('distribution/index', [
            'departments' => $departments,
            'selectedDepartmentId' => $departmentId,
            'overview' => $departmentId ? $this->service->overview($departmentId) : null,
        ]);
    }

    public function autoPreview(Request $request): Response
    {
        $departments = $this->service->availableDepartments($request->user());
        $departmentId = $this->resolveDepartment($request, $departments);
        $scope = $request->input('scope', 'unassigned');

        return Inertia::render('distribution/index', [
            'departments' => $departments,
            'selectedDepartmentId' => $departmentId,
            'overview' => $departmentId ? $this->service->overview($departmentId) : null,
            'preview' => $departmentId ? $this->service->autoDistributePreview($departmentId, $scope) : null,
        ]);
    }

    public function apply(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'department_id' => ['required', 'exists:departments,id'],
            'method' => ['nullable', 'in:auto,manual'],
            'assignments' => ['required', 'array'],
            'assignments.*.school_id' => ['required', 'exists:schools,id'],
            'assignments.*.supervisor_id' => ['required', 'exists:users,id'],
        ]);

        $this->authorizeDepartment($request, (int) $data['department_id']);
        $this->service->saveAssignments((int) $data['department_id'], $data['assignments'], $data['method'] ?? 'auto');

        return back()->with('success', 'تم حفظ التوزيع');
    }

    public function assign(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'department_id' => ['required', 'exists:departments,id'],
            'school_id' => ['required', 'exists:schools,id'],
            'supervisor_id' => ['required', 'exists:users,id'],
        ]);

        $this->authorizeDepartment($request, (int) $data['department_id']);
        $this->service->assign((int) $data['school_id'], (int) $data['supervisor_id'], (int) $data['department_id'], 'manual');

        return back(303)->with('success', 'تم الإسناد');
    }

    public function unassign(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'department_id' => ['required', 'exists:departments,id'],
            'school_id' => ['required', 'exists:schools,id'],
        ]);

        $this->authorizeDepartment($request, (int) $data['department_id']);
        $this->service->unassign((int) $data['school_id'], (int) $data['department_id']);

        return back(303)->with('success', 'تم إلغاء الإسناد');
    }

    public function clear(Request $request): RedirectResponse
    {
        $data = $request->validate(['department_id' => ['required', 'exists:departments,id']]);
        $this->authorizeDepartment($request, (int) $data['department_id']);
        $this->service->clear((int) $data['department_id']);

        return back()->with('success', 'تمت إعادة التعيين (مسح التوزيع)');
    }

    /** يحدّد القسم المطلوب مع احترام نطاق المستخدم. */
    private function resolveDepartment(Request $request, $departments): ?int
    {
        $requested = $request->integer('department');
        $allowed = $departments->pluck('id')->all();

        if ($requested && in_array($requested, $allowed, true)) {
            return $requested;
        }

        return $allowed[0] ?? null;
    }

    private function authorizeDepartment(Request $request, int $departmentId): void
    {
        $allowed = $this->service->availableDepartments($request->user())->pluck('id')->all();
        abort_unless(in_array($departmentId, $allowed, true), 403, 'لا تملك صلاحية على هذا القسم');
    }
}
