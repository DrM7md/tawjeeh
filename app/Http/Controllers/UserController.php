<?php

namespace App\Http\Controllers;

use App\Http\Requests\UserRequest;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function __construct(private readonly UserService $service) {}

    public function index(): Response
    {
        return Inertia::render('organization/users/index', [
            'users' => $this->service->list(),
            'departments' => Department::orderBy('name')->get(['id', 'name']),
            'roles' => Role::orderBy('level')->get(['id', 'display_name', 'level']),
        ]);
    }

    public function store(UserRequest $request): RedirectResponse
    {
        $this->service->create($request->validated());

        return back()->with('success', 'تم إضافة المستخدم بنجاح');
    }

    public function update(UserRequest $request, User $user): RedirectResponse
    {
        $this->service->update($user, $request->validated());

        return back()->with('success', 'تم تحديث المستخدم بنجاح');
    }

    public function destroy(User $user): RedirectResponse
    {
        if ($user->id === auth()->id()) {
            return back()->with('error', 'لا يمكنك حذف حسابك الخاص');
        }

        $this->service->delete($user);

        return back()->with('success', 'تم حذف المستخدم');
    }
}
