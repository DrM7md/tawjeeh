<?php

namespace App\Support;

use App\Models\Department;
use App\Models\SchoolAssignment;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * بنية الإشراف المشتركة للتنقّل الهرمي: الأقسام، وموجّهو القسم (مع النوع)،
 * ومدارس كل موجّه المكلّف بها. تُستخدم لبناء بطاقات الأقسام/الموجهين في الصفحات التشغيلية.
 */
class SupervisionStructure
{
    /** الأقسام المفعّلة (مرتّبة). @return Collection<int,Department> */
    public function departments(): Collection
    {
        return Department::where('is_active', true)->orderBy('name')->get(['id', 'name']);
    }

    /** موجّهو قسم محدّد (مع النوع) مرتّبون بالاسم. @return Collection<int,User> */
    public function supervisors(int $departmentId): Collection
    {
        return User::where('department_id', $departmentId)
            ->where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR))
            ->orderBy('name')
            ->get(['id', 'name', 'gender']);
    }

    /**
     * مدارس كل موجّه المكلّف بها (للعام المختار عبر سكوب SchoolAssignment).
     *
     * @param  Collection<int,int>  $supervisorIds
     * @return Collection<int,Collection<int,int>>  [supervisor_id => Collection<school_id>]
     */
    public function schoolIdsBySupervisor(Collection $supervisorIds): Collection
    {
        return SchoolAssignment::whereIn('supervisor_id', $supervisorIds)
            ->get(['supervisor_id', 'school_id'])
            ->groupBy('supervisor_id')
            ->map(fn ($rows) => $rows->pluck('school_id'));
    }

    /** مدارس موجّه واحد المكلّف بها. @return Collection<int,int> */
    public function schoolIdsFor(int $supervisorId): Collection
    {
        return SchoolAssignment::where('supervisor_id', $supervisorId)->pluck('school_id');
    }
}
