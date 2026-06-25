<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DepartmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('departments.manage');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'head_user_id' => ['nullable', 'exists:users,id'],
            'color' => ['nullable', 'string', 'max:30'],
            'is_active' => ['boolean'],
        ];
    }
}
