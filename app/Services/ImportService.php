<?php

namespace App\Services;

use App\Models\Coordinator;
use App\Models\Department;
use App\Models\ImportBatch;
use App\Models\School;
use App\Models\Stage;
use App\Models\Teacher;
use App\Models\TeacherClassification;
use App\Support\ActiveContext;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

/**
 * استيراد بيانات المدارس من Excel: تحليل → معاينة → تحديث ذكي + كشف تكرار + سجل.
 * المرجع: Brain/05-BUSINESS-RULES.md (G) + Brain/phases/PHASE-4-import.md
 */
class ImportService
{
    /** خرائط أسماء الأعمدة العربية المقبولة. */
    private const HEADERS = [
        'school' => ['المدرسة', 'اسم المدرسة'],
        'stage' => ['المرحلة'],
        'department' => ['المادة', 'القسم'],
        'coordinator' => ['المنسق', 'اسم المنسق'],
        'teacher' => ['المعلم', 'اسم المعلم'],
        'classification' => ['التصنيف'],
        'sections' => ['عدد الشعب', 'الشعب'],
    ];

    public function __construct(private readonly ActiveContext $context) {}

    /** قالب الأعمدة للتنزيل. @return list<string> */
    public function templateHeaders(): array
    {
        return ['المدرسة', 'المرحلة', 'المادة', 'المنسق', 'المعلم', 'التصنيف', 'عدد الشعب'];
    }

    /** يحوّل ملف Excel إلى صفوف معيارية (assoc). @return list<array<string,string>> */
    public function parse(string $path): array
    {
        $sheets = Excel::toArray(new class {}, $path);
        $rows = $sheets[0] ?? [];
        if (empty($rows)) {
            return [];
        }

        $header = array_map(fn ($h) => trim((string) $h), array_shift($rows));
        $map = $this->mapColumns($header);

        $result = [];
        foreach ($rows as $row) {
            // تجاهل الصفوف الفارغة تمامًا
            if (count(array_filter($row, fn ($c) => trim((string) $c) !== '')) === 0) {
                continue;
            }
            $item = [];
            foreach ($map as $key => $idx) {
                $item[$key] = $idx !== null ? trim((string) ($row[$idx] ?? '')) : '';
            }
            $result[] = $item;
        }

        return $result;
    }

    /** يبني معاينة بحالة كل صف دون حفظ. */
    public function preview(array $rows): array
    {
        $departments = Department::pluck('id', 'name');
        $summary = ['new' => 0, 'update' => 0, 'error' => 0];
        $preview = [];

        foreach ($rows as $i => $row) {
            $analysis = $this->analyzeRow($row, $departments);
            $summary[$analysis['status']]++;
            $preview[] = ['row' => $i + 2, ...$row, 'status' => $analysis['status'], 'message' => $analysis['message']];
        }

        return ['rows' => $preview, 'summary' => $summary, 'total' => count($rows)];
    }

    /** ينفّذ الاستيراد (تحديث ذكي) + يسجّل الدفعة والأخطاء. */
    public function import(array $rows, string $filename, ?int $userId): ImportBatch
    {
        $departments = Department::pluck('id', 'name');
        $stages = Stage::pluck('id', 'name');
        $classifications = TeacherClassification::pluck('id', 'name');

        $batch = ImportBatch::create([
            'user_id' => $userId,
            'original_filename' => $filename,
            'status' => 'processing',
            'total_rows' => count($rows),
        ]);

        $imported = 0;
        $updated = 0;
        $failed = 0;
        $errors = [];

        DB::transaction(function () use ($rows, $departments, $stages, $classifications, $batch, &$imported, &$updated, &$failed, &$errors) {
            foreach ($rows as $i => $row) {
                $analysis = $this->analyzeRow($row, $departments);
                if ($analysis['status'] === 'error') {
                    $failed++;
                    $errors[] = ['import_batch_id' => $batch->id, 'row_number' => $i + 2, 'message' => $analysis['message'], 'raw_data' => $row];
                    continue;
                }

                $deptId = $departments[$row['department']];
                $stageId = $row['stage'] !== '' ? ($stages[$row['stage']] ?? null) : null;
                $classId = $row['classification'] !== '' ? ($classifications[$row['classification']] ?? null) : null;

                $school = School::firstOrCreate(['name' => $row['school']], ['is_active' => true, 'stage_id' => $stageId]);

                $coordinatorId = null;
                if ($row['coordinator'] !== '') {
                    $coordinator = Coordinator::updateOrCreate(
                        ['school_id' => $school->id, 'department_id' => $deptId, 'name' => $row['coordinator']],
                        ['stage_id' => $stageId],
                    );
                    $coordinatorId = $coordinator->id;
                }

                $teacher = Teacher::updateOrCreate(
                    ['school_id' => $school->id, 'department_id' => $deptId, 'name' => $row['teacher']],
                    [
                        'coordinator_id' => $coordinatorId,
                        'stage_id' => $stageId,
                        'classification_id' => $classId,
                        'sections_count' => (int) ($row['sections'] ?: 0),
                    ],
                );

                $teacher->wasRecentlyCreated ? $imported++ : $updated++;
            }

            if (! empty($errors)) {
                $batch->errors()->createMany($errors);
            }
        });

        $batch->update([
            'status' => 'completed',
            'imported_rows' => $imported,
            'updated_rows' => $updated,
            'failed_rows' => $failed,
            'summary' => ['imported' => $imported, 'updated' => $updated, 'failed' => $failed],
        ]);

        return $batch->fresh('errors');
    }

    /* ===================== مساعدات ===================== */

    private function mapColumns(array $header): array
    {
        $map = [];
        foreach (self::HEADERS as $key => $aliases) {
            $map[$key] = null;
            foreach ($header as $idx => $name) {
                if (in_array($name, $aliases, true)) {
                    $map[$key] = $idx;
                    break;
                }
            }
        }

        return $map;
    }

    private function analyzeRow(array $row, $departments): array
    {
        if (($row['school'] ?? '') === '') {
            return ['status' => 'error', 'message' => 'اسم المدرسة مطلوب'];
        }
        if (($row['teacher'] ?? '') === '') {
            return ['status' => 'error', 'message' => 'اسم المعلم مطلوب'];
        }
        if (($row['department'] ?? '') === '' || ! $departments->has($row['department'])) {
            return ['status' => 'error', 'message' => 'المادة غير معروفة: '.($row['department'] ?: '—')];
        }

        // موجود مسبقًا؟ (تحديث) وإلا جديد
        $deptId = $departments[$row['department']];
        $school = School::where('name', $row['school'])->first();
        if ($school) {
            $exists = Teacher::where('school_id', $school->id)->where('department_id', $deptId)->where('name', $row['teacher'])->exists();
            if ($exists) {
                return ['status' => 'update', 'message' => 'تحديث معلم موجود'];
            }
        }

        return ['status' => 'new', 'message' => 'سجل جديد'];
    }
}
