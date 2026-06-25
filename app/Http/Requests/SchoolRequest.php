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
        $schoolId = $this->route('school')?->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50', Rule::unique('schools', 'code')->ignore($schoolId)],
            'stage_id' => ['nullable', 'exists:stages,id'],
            'gender' => ['nullable', Rule::in(['boys', 'girls', 'mixed'])],
            'zone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ];
    }
}
