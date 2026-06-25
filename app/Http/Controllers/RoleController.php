<?php

namespace App\Http\Controllers;

use App\Http\Requests\RoleRequest;
use App\Models\Role;
use App\Services\RoleService;
use App\Support\Permissions;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function __construct(private readonly RoleService $service) {}

    public function index(): Response
    {
        return Inertia::render('organization/roles/index', [
            'roles' => $this->service->list(),
            'permissionGroups' => Permissions::groups(),
        ]);
    }

    public function store(RoleRequest $request): RedirectResponse
    {
        $this->service->create($request->validated());

        return back()->with('success', 'تم إنشاء الدور بنجاح');
    }

    public function update(RoleRequest $request, Role $role): RedirectResponse
    {
        $this->service->update($role, $request->validated());

        return back()->with('success', 'تم تحديث الدور بنجاح');
    }

    public function destroy(Role $role): RedirectResponse
    {
        if ($role->is_system) {
            return back()->with('error', 'لا يمكن حذف أدوار النظام');
        }

        $this->service->delete($role);

        return back()->with('success', 'تم حذف الدور');
    }
}
