<?php

namespace App\Services;

use App\Models\School;
use App\Models\SchoolPrincipal;
use App\Support\ActiveContext;
use Illuminate\Database\Eloquent\Collection;

class SchoolService
{
    public function __construct(private readonly ActiveContext $context) {}

    /** @return Collection<int, School> */
    public function list(): Collection
    {
        return School::query()
            ->with(['stage:id,name', 'principal:id,school_id,name,academic_year_id'])
            ->orderBy('name')
            ->get();
    }

    public function create(array $data): School
    {
        $principal = $data['principal'] ?? null;
        unset($data['principal']);

        $school = School::create($data);
        $this->syncPrincipal($school, $principal);

        return $school;
    }

    public function update(School $school, array $data): School
    {
        $hasPrincipal = array_key_exists('principal', $data);
        $principal = $data['principal'] ?? null;
        unset($data['principal']);

        $school->update($data);

        if ($hasPrincipal) {
            $this->syncPrincipal($school, $principal);
        }

        return $school;
    }

    /** يحفظ/يحدّث/يحذف مدير المدرسة للعام المختار. */
    private function syncPrincipal(School $school, ?string $name): void
    {
        $yearId = $this->context->selectedYearId();
        if (! $yearId) {
            return;
        }

        $name = trim((string) $name);
        if ($name === '') {
            SchoolPrincipal::where('school_id', $school->id)->where('academic_year_id', $yearId)->delete();

            return;
        }

        SchoolPrincipal::updateOrCreate(
            ['school_id' => $school->id, 'academic_year_id' => $yearId],
            ['name' => $name],
        );
    }

    public function delete(School $school): void
    {
        $school->delete();
    }
}
