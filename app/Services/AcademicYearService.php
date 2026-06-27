<?php

namespace App\Services;

use App\Models\AcademicYear;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class AcademicYearService
{
    /** @return Collection<int, AcademicYear> */
    public function list(): Collection
    {
        return AcademicYear::query()
            ->withCount('semesters')
            ->with('semesters:id,academic_year_id,name,is_active')
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->get();
    }

    public function create(array $data, bool $generateSemesters = true): AcademicYear
    {
        return DB::transaction(function () use ($data, $generateSemesters) {
            $year = AcademicYear::create([
                ...$data,
                'created_by' => auth()->id(),
            ]);

            if ($generateSemesters) {
                $year->semesters()->createMany([
                    ['name' => 'الفصل الأول'],
                    ['name' => 'الفصل الثاني'],
                ]);
            }

            return $year;
        });
    }

    public function update(AcademicYear $year, array $data): AcademicYear
    {
        $year->update($data);

        return $year;
    }

    /** تفعيل عام واحد فقط (AY-1) — ذرّيًا. يُلغى تفعيل البقية. */
    public function activate(AcademicYear $year): AcademicYear
    {
        DB::transaction(function () use ($year) {
            AcademicYear::where('id', '!=', $year->id)->update(['is_active' => false]);
            $year->update(['is_active' => true]);
        });

        return $year->refresh();
    }

    public function delete(AcademicYear $year): void
    {
        $year->delete();
    }
}
