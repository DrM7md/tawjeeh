<?php

namespace App\Http\Controllers;

use App\Services\SupervisionReportService;
use App\Support\SupervisionRatings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * تقارير الزيارات الإشرافية — صفحات كاملة (تُفتح من قائمة «تقارير» المنسدلة).
 * مقيّدة بنطاق المستخدم عبر Visit::visibleTo داخل الخدمة.
 */
class SupervisionReportController extends Controller
{
    public function __construct(private readonly SupervisionReportService $service) {}

    public function department(Request $request): Response
    {
        return Inertia::render('visits/reports/department', $this->service->departmentReport($request->user()));
    }

    public function comparison(Request $request): Response
    {
        $user = $request->user();
        $departments = $this->service->scopedDepartments($user);
        $departmentId = $request->integer('department_id') ?: $departments->first()?->id;

        return Inertia::render('visits/reports/comparison', [
            'departments' => $departments,
            'selectedDepartmentId' => $departmentId,
            'report' => $departmentId ? $this->service->teacherComparison($user, $departmentId) : null,
        ]);
    }

    public function performance(Request $request): Response
    {
        $user = $request->user();
        $departments = $this->service->scopedDepartments($user);
        $departmentId = $request->integer('department_id') ?: $departments->first()?->id;
        $teacherId = $request->integer('teacher_id') ?: null;

        return Inertia::render('visits/reports/performance', [
            'departments' => $departments,
            'selectedDepartmentId' => $departmentId,
            'teachers' => $departmentId ? $this->service->teachersInDepartment($user, $departmentId) : [],
            'selectedTeacherId' => $teacherId,
            'report' => $teacherId ? $this->service->teacherPerformance($user, $teacherId) : null,
        ]);
    }

    public function coverage(Request $request): Response
    {
        return Inertia::render('visits/reports/coverage', $this->service->coverage($request->user(), $request->integer('visitor_id') ?: null));
    }

    public function recommendations(Request $request): Response
    {
        $user = $request->user();
        $departments = $this->service->scopedDepartments($user);
        $departmentId = $request->integer('department_id') ?: $departments->first()?->id;
        $teacherId = $request->integer('teacher_id') ?: null;

        return Inertia::render('visits/reports/recommendations', array_merge(
            $this->service->recommendationsFollowup($user, $teacherId),
            [
                'departments' => $departments,
                'selectedDepartmentId' => $departmentId,
                'teachers' => $departmentId ? $this->service->teachersInDepartment($user, $departmentId) : [],
                'selectedTeacherId' => $teacherId,
                'canEdit' => $user->isSuper() || $user->hasPermission('visits.update'),
            ],
        ));
    }

    public function crossYear(Request $request): Response
    {
        return Inertia::render('visits/reports/cross-year', $this->service->crossYearStatistics($request->user()));
    }

    public function saveFollowup(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'visit_id' => ['required', 'integer'],
            'domain_id' => ['required', 'integer'],
            'status' => ['required', Rule::in(array_keys(SupervisionRatings::FOLLOWUP_STATUSES))],
        ]);

        $this->service->saveFollowup($data['visit_id'], $data['domain_id'], $data['status']);

        return back()->with('success', 'تم تحديث حالة المتابعة');
    }

    /** صفحة طباعة موحّدة لأي تقرير (تُفتح في تبويب جديد). */
    public function print(Request $request): Response
    {
        $user = $request->user();
        $type = $request->string('type')->toString();

        $report = match ($type) {
            'comparison' => $this->service->teacherComparison($user, $request->integer('department_id')),
            'performance' => $this->service->teacherPerformance($user, $request->integer('teacher_id')),
            'coverage' => $this->service->coverage($user, $request->integer('visitor_id') ?: null),
            'recommendations' => $this->service->recommendationsFollowup($user, $request->integer('teacher_id') ?: null),
            'cross-year' => $this->service->crossYearStatistics($user),
            default => $this->service->departmentReport($user),
        };

        $valid = ['comparison', 'performance', 'coverage', 'recommendations', 'cross-year'];

        return Inertia::render('visits/report-print', [
            'type' => in_array($type, $valid, true) ? $type : 'department',
            'report' => $report,
        ]);
    }
}
