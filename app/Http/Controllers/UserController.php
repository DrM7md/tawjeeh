<?php

namespace App\Http\Controllers;

use App\Http\Requests\UserRequest;
use App\Models\Department;
use App\Models\Role;
use App\Models\SchoolAssignment;
use App\Models\TestReview;
use App\Models\User;
use App\Models\Visit;
use App\Services\UserService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function __construct(private readonly UserService $service) {}

    public function index(Request $request): Response
    {
        $viewer = $request->user();

        return Inertia::render('organization/users/index', [
            'users' => $this->service->list($viewer),
            'departments' => Department::orderBy('name')->get(['id', 'name']),
            'roles' => Role::orderBy('level')->get(['id', 'display_name', 'level']),
            'canViewAllDepartments' => $this->service->canViewAll($viewer),
        ]);
    }

    public function show(Request $request, User $user): Response
    {
        $viewer = $request->user();

        // رئيس القسم لا يفتح إلا ملفات مستخدمي قسمه.
        if (! $this->service->canViewAll($viewer) && $user->department_id !== $viewer->department_id) {
            abort(403);
        }

        $user->load(['department:id,name', 'roles:id,display_name,level']);

        $visits = Visit::where('supervisor_id', $user->id)
            ->with(['school:id,name', 'department:id,name'])
            ->latest('visit_date')
            ->get();

        $reviews = TestReview::where('supervisor_id', $user->id)
            ->with(['school:id,name', 'department:id,name', 'stage:id,name'])
            ->latest('reviewed_at')
            ->get();

        $assignedSchools = SchoolAssignment::where('supervisor_id', $user->id)
            ->with(['school:id,name', 'department:id,name'])
            ->get();

        return Inertia::render('organization/users/show', [
            'user' => $user,
            'stats' => [
                'visits' => $visits->count(),
                'reviews' => $reviews->count(),
                'schools' => $assignedSchools->count(),
            ],
            'visits' => $visits,
            'reviews' => $reviews,
            'assignedSchools' => $assignedSchools,
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
