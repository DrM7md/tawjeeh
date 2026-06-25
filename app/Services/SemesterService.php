<?php

namespace App\Services;

use App\Models\AcademicYear;
use App\Models\Semester;
use Illuminate\Support\Facades\DB;

class SemesterService
{
    public function create(AcademicYear $year, array $data): Semester
    {
        return $year->semesters()->create([
            ...$data,
            'status' => $data['status'] ?? 'not_started',
        ]);
    }

    public function update(Semester $semester, array $data): Semester
    {
        $semester->update($data);

        return $semester;
    }

    /** تفعيل فصل واحد فقط داخل العام (SM-2) — ذرّيًا. */
    public function activate(Semester $semester): Semester
    {
        DB::transaction(function () use ($semester) {
            Semester::where('academic_year_id', $semester->academic_year_id)
                ->where('id', '!=', $semester->id)
                ->update(['is_active' => false]);
            $semester->update(['is_active' => true, 'status' => 'active']);
        });

        return $semester->refresh();
    }

    /** إغلاق الفصل (يُمنع التعديل، تبقى المؤشرات متاحة) — SM-5. */
    public function close(Semester $semester): Semester
    {
        $semester->update(['is_active' => false, 'status' => 'closed']);

        return $semester;
    }

    public function delete(Semester $semester): void
    {
        $semester->delete();
    }
}
