<?php

namespace App\Services;

use App\Models\Department;
use Illuminate\Database\Eloquent\Collection;

class DepartmentService
{
    /** @return Collection<int, Department> */
    public function list(): Collection
    {
        return Department::query()
            ->with('head:id,name')
            ->withCount('users')
            ->orderBy('name')
            ->get();
    }

    public function create(array $data): Department
    {
        return Department::create($data);
    }

    public function update(Department $department, array $data): Department
    {
        $department->update($data);

        return $department;
    }

    public function delete(Department $department): void
    {
        $department->delete();
    }
}
