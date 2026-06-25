<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Hash;

class UserService
{
    /** @return Collection<int, User> */
    public function list(): Collection
    {
        return User::query()
            ->with(['department:id,name', 'roles:id,name,display_name,level'])
            ->orderBy('name')
            ->get();
    }

    public function create(array $data): User
    {
        $roleIds = $data['role_ids'] ?? [];
        unset($data['role_ids']);

        $data['password'] = Hash::make($data['password']);

        $user = User::create($data);
        $user->roles()->sync($roleIds);

        return $user;
    }

    public function update(User $user, array $data): User
    {
        $roleIds = $data['role_ids'] ?? null;
        unset($data['role_ids']);

        // لا تُحدّث كلمة المرور إن تُركت فارغة.
        if (empty($data['password'])) {
            unset($data['password']);
        } else {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update($data);

        if (is_array($roleIds)) {
            $user->roles()->sync($roleIds);
        }

        return $user;
    }

    public function delete(User $user): void
    {
        $user->delete();
    }
}
