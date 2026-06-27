<?php

namespace App\Http\Controllers;

use App\Exports\CoordinatorsExport;
use App\Http\Concerns\ResolvesDrilldown;
use App\Models\CoordinatorAssignment;
use App\Models\Department;
use App\Models\School;
use App\Models\SchoolAssignment;
use App\Models\User;
use App\Support\ActiveContext;
use App\Support\Permissions;
use App\Support\SupervisionStructure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * صفحة المنسقين — شاشة متعددة المستويات حسب الدور:
 *  - رئيس التوجيه/المساعد: الأقسام ← الموجهون ← منسّقو موجّه.
 *  - رئيس القسم: موجهو قسمه ← منسّقو موجّه.
 *  - الموجه: منسّقوه مباشرة.
 *
 * في مستوى الموجهين يمكن التبديل (من الواجهة) بين بطاقات الموجهين وعرض «كل المنسقين والمنسقات» للقسم.
 * البطاقات تعرض عدد المنسقين فقط (دون نسبة إنجاز). تبويب بنين/بنات يفرّق المنسقين/المنسقات.
 */
class CoordinatorController extends Controller
{
    use ResolvesDrilldown;

    public function __construct(private readonly SupervisionStructure $structure) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $canAll = $user->isSuper() || $user->isLevel(1);
        $canDept = $user->hasRole(Permissions::ROLE_DEPARTMENT_HEAD);

        $nav = $this->resolveDrilldown($request, $user, $canAll, $canDept);

        // المستوى الأول: الأقسام (رئيس التوجيه).
        if ($nav['level'] === 'departments') {
            return Inertia::render('coordinators/index', [
                'view' => 'departments',
                'departmentCards' => $this->departmentCards(),
            ]);
        }

        // المستوى الثاني: موجهو قسم محدد + (للعرض البديل) كل منسّقي القسم.
        if ($nav['level'] === 'supervisors') {
            $department = Department::findOrFail($nav['departmentId']);
            $list = $this->coordinatorsQuery()->where('department_id', $department->id)->get()
                ->sortBy(fn (CoordinatorAssignment $a) => [$a->school?->name, $a->teacher?->name])->values();

            return Inertia::render('coordinators/index', array_merge(
                [
                    'view' => 'supervisors',
                    'department' => ['id' => $department->id, 'name' => $department->name],
                    'supervisors' => $this->supervisorCards($department->id),
                    'canDrillDepartments' => $canAll,
                ],
                $this->listPayload($list, $user),
            ));
        }

        // المستوى الثالث: منسّقو موجّه (أو منسّقو المستخدم نفسه).
        $supervisor = $nav['supervisor'];
        $isSelf = $supervisor && $supervisor->id === $user->id;
        $department = $nav['departmentId'] ? Department::find($nav['departmentId']) : null;

        $list = $this->coordinatorsQuery()
            ->whereIn('school_id', $this->structure->schoolIdsFor($supervisor->id))
            ->when($supervisor->department_id, fn ($q) => $q->where('department_id', $supervisor->department_id))
            ->get()->sortBy(fn (CoordinatorAssignment $a) => [$a->school?->name, $a->teacher?->name])->values();

        return Inertia::render('coordinators/index', array_merge(
            [
                'view' => 'content',
                'supervisor' => $isSelf || ! $supervisor ? null : ['id' => $supervisor->id, 'name' => $supervisor->name],
                'department' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
                'canDrillSupervisors' => $canAll || $canDept,
            ],
            $this->listPayload($list, $user),
        ));
    }

    /** تصدير رسمي للمنسقين الحاليين ضمن نطاق المستخدم (التكاليف النشطة). */
    public function export(Request $request): BinaryFileResponse
    {
        $active = $this->scopedQuery($request->user())
            ->where('status', CoordinatorAssignment::STATUS_ACTIVE)
            ->get()
            ->sortBy(fn (CoordinatorAssignment $a) => [$a->school?->name, $a->teacher?->name])
            ->values();

        return Excel::download(
            new CoordinatorsExport($active, app(ActiveContext::class)->selectedYear()?->name),
            'كشف_المنسقين.xlsx',
        );
    }

    /** تنزيل المنسق إلى معلم: إغلاق التكليف (end_date=اليوم) دون فقد السجل التاريخي. */
    public function demote(Request $request, CoordinatorAssignment $assignment): RedirectResponse
    {
        $data = $request->validate([
            'ended_reason' => ['nullable', 'string', 'max:255'],
        ]);

        abort_unless($assignment->status === CoordinatorAssignment::STATUS_ACTIVE, 422, 'هذا التكليف منتهٍ بالفعل');

        $assignment->update([
            'end_date' => now()->toDateString(),
            'status' => CoordinatorAssignment::STATUS_ENDED,
            'ended_reason' => $data['ended_reason'] ?? null,
        ]);

        return back()->with('success', "تم تنزيل «{$assignment->teacher->name}» إلى معلم — حُفظ سجل التنسيق السابق");
    }

    /** الحمولة المشتركة لمستوى يعرض قائمة منسقين (المنسقون + قوائم الفلاتر + الصلاحية). @return array<string,mixed> */
    private function listPayload(Collection $list, User $user): array
    {
        $supMap = $this->supervisorsBySchoolDept($list);

        return [
            'coordinators' => $list->map(fn (CoordinatorAssignment $a) => $this->present($a, $supMap))->values(),
            'departments' => Department::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'schools' => School::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'canManage' => $user->can('coordinators.manage'),
        ];
    }

    /** بطاقات الأقسام: عدد المنسقين لكل قسم (دون نسبة إنجاز). @return list<array<string,mixed>> */
    private function departmentCards(): array
    {
        $counts = CoordinatorAssignment::query()
            ->selectRaw('department_id, COUNT(*) as c')->groupBy('department_id')->pluck('c', 'department_id');

        return $this->structure->departments()->map(fn ($d) => [
            'id' => $d->id,
            'name' => $d->name,
            'count' => (int) ($counts[$d->id] ?? 0),
        ])->all();
    }

    /** بطاقات الموجهين في قسم: عدد منسّقي مدارس كل موجّه (دون نسبة إنجاز). @return list<array<string,mixed>> */
    private function supervisorCards(int $departmentId): array
    {
        $supervisors = $this->structure->supervisors($departmentId);
        if ($supervisors->isEmpty()) {
            return [];
        }

        $schoolsBySup = $this->structure->schoolIdsBySupervisor($supervisors->pluck('id'));
        $countsBySchool = CoordinatorAssignment::where('department_id', $departmentId)
            ->whereIn('school_id', $schoolsBySup->flatten()->unique())
            ->selectRaw('school_id, COUNT(*) as c')->groupBy('school_id')->pluck('c', 'school_id');

        return $supervisors->map(function ($s) use ($schoolsBySup, $countsBySchool) {
            $sids = $schoolsBySup->get($s->id, collect());

            return [
                'id' => $s->id,
                'name' => $s->name,
                'gender' => $s->gender,
                'schools' => $sids->count(),
                'count' => (int) $sids->sum(fn ($id) => (int) ($countsBySchool[$id] ?? 0)),
            ];
        })->all();
    }

    /** استعلام تكاليف التنسيق الأساسي (بالعلاقات، النشط أولًا) دون نطاق. */
    private function coordinatorsQuery(): Builder
    {
        return CoordinatorAssignment::query()
            ->with([
                'teacher:id,name,national_id,classification_id,phone,email',
                'teacher.classification:id,name,color',
                'school:id,name,gender',
                'department:id,name',
            ])
            ->orderByDesc('status'); // النشط أولًا (active > ended أبجديًا معكوسًا)
    }

    /** استعلام تكاليف التنسيق ضمن نطاق المستخدم (للتصدير): رئيس=الكل، رئيس قسم=قسمه، موجّه=مدارسه. */
    private function scopedQuery(User $user): Builder
    {
        $query = $this->coordinatorsQuery();

        if ($user->isSuper() || $user->isLevel(1)) {
            return $query;
        }

        if ($user->hasRole(Permissions::ROLE_DEPARTMENT_HEAD) && $user->department_id) {
            return $query->where('department_id', $user->department_id);
        }

        return $query
            ->whereIn('school_id', $this->structure->schoolIdsFor($user->id))
            ->when($user->department_id, fn ($q) => $q->where('department_id', $user->department_id));
    }

    /**
     * الموجّه المسؤول عن كل منسق = الموجّه المسنَدة إليه مدرسته في قسمه (من توزيع المدارس).
     *
     * @param  Collection<int,CoordinatorAssignment>  $list
     * @return Collection<string,SchoolAssignment>  مفهرسة بـ "school_id-department_id"
     */
    private function supervisorsBySchoolDept(Collection $list): Collection
    {
        return SchoolAssignment::whereIn('school_id', $list->pluck('school_id')->unique())
            ->with('supervisor:id,name,gender')
            ->get()
            ->keyBy(fn (SchoolAssignment $sa) => $sa->school_id.'-'.$sa->department_id);
    }

    /**
     * @param  Collection<string,SchoolAssignment>  $supMap
     * @return array<string,mixed>
     */
    private function present(CoordinatorAssignment $a, Collection $supMap): array
    {
        $supervisor = $supMap->get($a->school_id.'-'.$a->department_id)?->supervisor;

        return [
            'id' => $a->id,
            'teacher_id' => $a->teacher_id,
            'name' => $a->teacher?->name,
            'national_id' => $a->teacher?->national_id,
            'phone' => $a->teacher?->phone,
            'email' => $a->teacher?->email,
            'department' => $a->department?->name,
            'school' => $a->school?->name,
            'gender' => $a->school?->gender,
            'classification' => $a->teacher?->classification?->name,
            'classification_color' => $a->teacher?->classification?->color,
            'start_date' => $a->start_date?->toDateString(),
            'end_date' => $a->end_date?->toDateString(),
            'tenure' => $a->tenureLabel(),
            'tenure_months' => $a->tenureMonths(),
            'status' => $a->status,
            'ended_reason' => $a->ended_reason,
            'supervisor_id' => $supervisor?->id,
            'supervisor' => $supervisor?->name,
            'supervisor_gender' => $supervisor?->gender,
        ];
    }
}
