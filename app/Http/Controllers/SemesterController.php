<?php

namespace App\Http\Controllers;

use App\Http\Requests\SemesterRequest;
use App\Models\AcademicYear;
use App\Models\Semester;
use App\Services\SemesterService;
use Illuminate\Http\RedirectResponse;

class SemesterController extends Controller
{
    public function __construct(private readonly SemesterService $service) {}

    public function store(SemesterRequest $request): RedirectResponse
    {
        $year = AcademicYear::findOrFail($request->validated()['academic_year_id']);
        $this->service->create($year, $request->validated());

        return back()->with('success', 'تم إضافة الفصل الدراسي');
    }

    public function update(SemesterRequest $request, Semester $semester): RedirectResponse
    {
        $this->service->update($semester, $request->validated());

        return back()->with('success', 'تم تحديث الفصل الدراسي');
    }

    public function activate(Semester $semester): RedirectResponse
    {
        $this->service->activate($semester);

        return back()->with('success', "تم تفعيل «{$semester->name}»");
    }

    public function close(Semester $semester): RedirectResponse
    {
        $this->service->close($semester);

        return back()->with('success', 'تم إغلاق الفصل');
    }

    public function destroy(Semester $semester): RedirectResponse
    {
        $this->service->delete($semester);

        return back()->with('success', 'تم حذف الفصل');
    }
}
