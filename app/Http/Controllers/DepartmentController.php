<?php

namespace App\Http\Controllers;

use App\Http\Requests\DepartmentRequest;
use App\Models\Department;
use App\Models\User;
use App\Services\DepartmentService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DepartmentController extends Controller
{
    public function __construct(private readonly DepartmentService $service) {}

    public function index(): Response
    {
        return Inertia::render('organization/departments/index', [
            'departments' => $this->service->list(),
            'users' => User::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(DepartmentRequest $request): RedirectResponse
    {
        $this->service->create($request->validated());

        return back()->with('success', 'تم إضافة القسم بنجاح');
    }

    public function update(DepartmentRequest $request, Department $department): RedirectResponse
    {
        $this->service->update($department, $request->validated());

        return back()->with('success', 'تم تحديث القسم بنجاح');
    }

    public function destroy(Department $department): RedirectResponse
    {
        $this->service->delete($department);

        return back()->with('success', 'تم حذف القسم');
    }
}
