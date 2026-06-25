<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->route('user');

        return $user
            ? $this->user()->can('users.update')
            : $this->user()->can('users.create');
    }

    public function rules(): array
    {
        $userId = $this->route('user')?->id;
        $isUpdate = (bool) $userId;

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password' => [$isUpdate ? 'nullable' : 'required', 'confirmed', Password::defaults()],
            'department_id' => ['nullable', 'exists:departments,id'],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_active' => ['boolean'],
            'role_ids' => ['array'],
            'role_ids.*' => ['exists:roles,id'],
        ];
    }
}
