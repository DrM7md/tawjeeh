<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademicYear extends Model
{
    use Auditable;

    protected $fillable = ['name', 'start_date', 'end_date', 'is_active', 'status', 'created_by'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function semesters(): HasMany
    {
        return $this->hasMany(Semester::class);
    }

    public function activeSemester(): HasMany
    {
        return $this->hasMany(Semester::class)->where('is_active', true);
    }

    public function isEditable(): bool
    {
        return $this->status === 'active';
    }
}
