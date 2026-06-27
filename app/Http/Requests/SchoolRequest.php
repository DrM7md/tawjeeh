<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SchoolRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('schools.manage');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'stage_id' => ['nullable', 'exists:stages,id'],
            'gender' => ['nullable', Rule::in(['boys', 'girls', 'mixed'])],
            'zone' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'principal' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ];
    }
}
