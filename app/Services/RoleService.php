<?php

namespace App\Services;

use App\Models\Role;
use Illuminate\Database\Eloquent\Collection;

class RoleService
{
    /** @return Collection<int, Role> */
    public function list(): Collection
    {
        return Role::query()
            ->withCount('users')
            ->orderBy('level')
            ->get();
    }

    public function create(array $data): Role
    {
        return Role::create($data);
    }

    public function update(Role $role, array $data): Role
    {
        // أدوار النظام: يُسمح بتعديل الصلاحيات فقط، لا المعرّف البرمجي.
        if ($role->is_system) {
            unset($data['name'], $data['level']);
        }

        $role->update($data);

        return $role;
    }

    public function delete(Role $role): void
    {
        $role->delete();
    }
}
