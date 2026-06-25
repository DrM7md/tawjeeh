<?php

namespace App\Http\Controllers;

use App\Http\Requests\AcademicYearRequest;
use App\Models\AcademicYear;
use App\Services\AcademicYearService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class AcademicYearController extends Controller
{
    public function __construct(private readonly AcademicYearService $service) {}

    public function index(): Response
    {
        return Inertia::render('academic/index', [
            'years' => $this->service->list(),
        ]);
    }

    public function store(AcademicYearRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $generate = (bool) ($data['generate_semesters'] ?? true);
        unset($data['generate_semesters']);

        $this->service->create($data, $generate);

        return back()->with('success', 'تم إنشاء العام الدراسي');
    }

    public function update(AcademicYearRequest $request, AcademicYear $academicYear): RedirectResponse
    {
        $data = $request->validated();
        unset($data['generate_semesters']);

        $this->service->update($academicYear, $data);

        return back()->with('success', 'تم تحديث العام الدراسي');
    }

    public function activate(AcademicYear $academicYear): RedirectResponse
    {
        $this->service->activate($academicYear);

        return back()->with('success', "تم تفعيل العام «{$academicYear->name}»");
    }

    public function close(AcademicYear $academicYear): RedirectResponse
    {
        $this->service->close($academicYear);

        return back()->with('success', 'تم إغلاق العام');
    }

    public function archive(AcademicYear $academicYear): RedirectResponse
    {
        $this->service->archive($academicYear);

        return back()->with('success', 'تمت أرشفة العام');
    }

    public function destroy(AcademicYear $academicYear): RedirectResponse
    {
        if ($academicYear->is_active) {
            return back()->with('error', 'لا يمكن حذف العام النشط');
        }

        $this->service->delete($academicYear);

        return back()->with('success', 'تم حذف العام');
    }
}
