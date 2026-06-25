<?php

namespace App\Models\Concerns;

use App\Models\Role;
use App\Support\Permissions;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * منطق الأدوار والصلاحيات للمستخدم. المرجع: Brain/03-RBAC.md
 */
trait HasRoles
{
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function hasRole(string $name): bool
    {
        return $this->roles->contains('name', $name);
    }

    /** هل المستخدم رئيس التوجيه (super)؟ */
    public function isSuper(): bool
    {
        return $this->hasRole(Permissions::ROLE_HEAD);
    }

    /** أدنى مستوى إداري للمستخدم (1 = الأعلى صلاحية). */
    public function level(): int
    {
        return (int) ($this->roles->min('level') ?? 99);
    }

    public function isLevel(int $level): bool
    {
        return $this->level() === $level;
    }

    /** اتحاد صلاحيات كل أدوار المستخدم. @return list<string> */
    public function permissions(): array
    {
        if ($this->isSuper()) {
            return Permissions::all();
        }

        return $this->roles
            ->flatMap(fn (Role $role) => $role->permissions ?? [])
            ->unique()
            ->values()
            ->all();
    }

    public function hasPermission(string $permission): bool
    {
        return $this->isSuper() || in_array($permission, $this->permissions(), true);
    }
}
