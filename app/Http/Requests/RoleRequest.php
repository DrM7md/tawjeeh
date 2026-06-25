<?php

namespace App\Http\Requests;

use App\Support\Permissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('roles.manage');
    }

    public function rules(): array
    {
        $roleId = $this->route('role')?->id;

        return [
            'name' => ['required', 'string', 'max:100', 'regex:/^[a-z_]+$/', Rule::unique('roles', 'name')->ignore($roleId)],
            'display_name' => ['required', 'string', 'max:255'],
            'level' => ['required', 'integer', 'between:1,3'],
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::in(Permissions::all())],
        ];
    }
}
