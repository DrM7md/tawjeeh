<?php

namespace App\Http\Controllers;

use App\Http\Requests\SchoolRequest;
use App\Models\School;
use App\Models\Stage;
use App\Services\SchoolService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class SchoolController extends Controller
{
    public function __construct(private readonly SchoolService $service) {}

    public function index(): Response
    {
        return Inertia::render('organization/schools/index', [
            'schools' => $this->service->list(),
            'stages' => Stage::orderBy('sort_order')->get(['id', 'name']),
        ]);
    }

    public function store(SchoolRequest $request): RedirectResponse
    {
        $this->service->create($request->validated());

        return back()->with('success', 'تم إضافة المدرسة بنجاح');
    }

    public function update(SchoolRequest $request, School $school): RedirectResponse
    {
        $this->service->update($school, $request->validated());

        return back()->with('success', 'تم تحديث المدرسة بنجاح');
    }

    public function destroy(School $school): RedirectResponse
    {
        $this->service->delete($school);

        return back()->with('success', 'تم حذف المدرسة');
    }
}
