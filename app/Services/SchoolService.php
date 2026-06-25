<?php

namespace App\Services;

use App\Models\School;
use Illuminate\Database\Eloquent\Collection;

class SchoolService
{
    /** @return Collection<int, School> */
    public function list(): Collection
    {
        return School::query()
            ->with('stage:id,name')
            ->orderBy('name')
            ->get();
    }

    public function create(array $data): School
    {
        return School::create($data);
    }

    public function update(School $school, array $data): School
    {
        $school->update($data);

        return $school;
    }

    public function delete(School $school): void
    {
        $school->delete();
    }
}
