<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Grade;
use App\Models\School;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\User;
use App\Support\ActiveContext;

/**
 * يجمّع بيانات صفحة تفاصيل المدرسة (المعلومات + معلمو القسم + الصفوف + الصلاحيات).
 * مشترك بين عرض الصفحة ومعاينة استيراد المعلمين حتى لا يتكرّر المنطق.
 */
class SchoolPagePresenter
{
    public function __construct(private readonly ActiveContext $context) {}

    /** @param array<string,mixed> $extra */
    public function props(School $school, User $user, array $extra = []): array
    {
        $school->loadMissing(['stage:id,name', 'principal:id,school_id,name,academic_year_id']);

        $departments = $this->visibleDepartments($user);

        $teachers = $departments->isNotEmpty()
            ? Teacher::where('school_id', $school->id)
                ->whereIn('department_id', $departments->pluck('id'))
                ->with(['grades:id,name', 'activeCoordinatorAssignment'])
                ->orderBy('is_active', 'desc')
                ->orderBy('name')
                ->get()
            : collect();

        $this->attachTransferredTo($teachers, $school);
        $teachers->each(fn (Teacher $t) => $t->setAttribute('is_coordinator', $t->activeCoordinatorAssignment !== null));

        $byDept = $teachers->groupBy('department_id');

        // مجموعات العرض: بطاقة لكل قسم/مادة مع معلميها
        $groups = $departments->map(fn (Department $d): array => [
            'id' => $d->id,
            'name' => $d->name,
            'canImport' => $this->canImportInto($user, $school, $d),
            'teachers' => ($byDept->get($d->id) ?? collect())->values(),
        ])->values();

        $grades = Grade::with('stage:id,name')
            ->orderBy('sort_order')
            ->get(['id', 'name', 'stage_id', 'sort_order']);

        return array_merge([
            'school' => $school,
            'departments' => $groups,
            'teachers' => $teachers, // مسطّحة (لإعادة الاستخدام في المعاينة/الاختبارات)
            'grades' => $grades,
            'isEditable' => $this->context->isEditable(),
        ], $extra);
    }

    /**
     * الأقسام المعروضة في الصفحة:
     * - مستخدم مرتبط بقسم (موجه/رئيس قسم): قسمه فقط.
     * - غير مرتبط (رئيس التوجيه/مساعده): كل الأقسام النشطة (بطاقة لكل مادة، ولو كانت فارغة).
     *
     * @return \Illuminate\Support\Collection<int,Department>
     */
    public function visibleDepartments(User $user)
    {
        if ($user->department_id) {
            return Department::whereKey($user->department_id)->get();
        }

        return Department::where('is_active', true)->orderBy('id')->get();
    }

    public function canImportInto(User $user, School $school, Department $department): bool
    {
        return $user->can('import.run')
            && ($user->can('schools.manage') || $this->isAssigned($user, $school, $department->id));
    }

    /**
     * يُلحِق بكل معلم غير نشط اسم المدرسة التي انتقل إليها (نشط الآن برقمه الشخصي).
     * يبقى null للمستقيلين أو من لا رقم شخصي لهم.
     *
     * @param  \Illuminate\Support\Collection<int,Teacher>  $teachers
     */
    private function attachTransferredTo($teachers, School $school): void
    {
        $inactiveNationalIds = $teachers
            ->where('is_active', false)
            ->pluck('national_id')
            ->filter()
            ->unique()
            ->values();

        $currentSchoolByNid = collect();
        if ($inactiveNationalIds->isNotEmpty()) {
            $currentSchoolByNid = Teacher::whereIn('national_id', $inactiveNationalIds)
                ->where('is_active', true)
                ->where('school_id', '!=', $school->id)
                ->with('school:id,name')
                ->get()
                ->keyBy('national_id');
        }

        $teachers->each(function (Teacher $t) use ($currentSchoolByNid) {
            $transferredTo = (! $t->is_active && $t->national_id && $currentSchoolByNid->has($t->national_id))
                ? $currentSchoolByNid->get($t->national_id)->school?->name
                : null;
            $t->setAttribute('transferred_to', $transferredTo);
        });
    }

    /** القسم المستهدف: قسم صريح (من الطلب)، وإلا قسم المستخدم، وإلا قسم إسناد المدرسة، وإلا أول قسم. */
    public function resolveDepartment(User $user, School $school, ?int $explicitDeptId = null): ?Department
    {
        $deptId = $explicitDeptId
            ?: $user->department_id
            ?: SchoolAssignment::where('school_id', $school->id)->value('department_id');

        return $deptId
            ? Department::find($deptId)
            : Department::orderBy('id')->first();
    }

    public function isAssigned(User $user, School $school, int $departmentId): bool
    {
        return SchoolAssignment::where('school_id', $school->id)
            ->where('department_id', $departmentId)
            ->where('supervisor_id', $user->id)
            ->exists();
    }
}
