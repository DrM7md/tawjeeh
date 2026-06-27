<?php

namespace App\Services\Import;

use App\Models\ImportBatch;
use App\Models\School;
use App\Models\SchoolPrincipal;
use App\Models\Stage;
use App\Support\ActiveContext;
use Illuminate\Support\Facades\DB;

/**
 * استيراد المدارس من Excel بمنطق المزامنة (الملف هو المصدر الأساسي):
 * - المدارس في الملف تُضاف/تُحدَّث وتصبح نشطة.
 * - المدارس الموجودة في النظام وغير المذكورة في الملف تصبح «غير نشطة» (لا تُحذف).
 * يسجّل «مدير المدرسة» للعام الدراسي المختار (سجل تاريخي).
 */
class SchoolImportService
{
    use ReadsSpreadsheet;

    private const ALIASES = [
        'name' => ['اسم المدرسة', 'المدرسة'],
        'stage' => ['المرحلة'],
        'gender' => ['النوع', 'نوع المدرسة'],
        'email' => ['إيميل المدرسة', 'ايميل المدرسة', 'البريد الإلكتروني', 'الإيميل'],
        'principal' => ['مدير المدرسة', 'المدير'],
    ];

    private const GENDERS = ['بنين' => 'boys', 'بنات' => 'girls', 'مشترك' => 'mixed'];

    public function __construct(private readonly ActiveContext $context) {}

    /** @return list<array<string,string>> */
    public function parse(string $path): array
    {
        return $this->readRows($path, self::ALIASES);
    }

    public function preview(array $rows): array
    {
        $stages = Stage::pluck('id', 'name');
        $summary = ['new' => 0, 'update' => 0, 'error' => 0, 'deactivate' => 0];
        $preview = [];

        foreach ($rows as $i => $row) {
            $analysis = $this->analyze($row, $stages);
            $summary[$analysis['status']]++;
            $preview[] = ['row' => $i + 1, ...$row, 'status' => $analysis['status'], 'message' => $analysis['message']];
        }

        // عدد المدارس النشطة التي ستُعطَّل لأنها غير موجودة في الملف (مزامنة).
        $names = $this->fileNames($rows);
        if ($names !== []) {
            $summary['deactivate'] = School::whereNotIn('name', $names)->where('is_active', true)->count();
        }

        return ['rows' => $preview, 'summary' => $summary, 'total' => count($rows)];
    }

    public function import(array $rows, string $filename, ?int $userId): ImportBatch
    {
        $stages = Stage::pluck('id', 'name');

        $batch = ImportBatch::create([
            'user_id' => $userId,
            'type' => 'schools',
            'original_filename' => $filename,
            'status' => 'processing',
            'total_rows' => count($rows),
        ]);

        $imported = 0;
        $updated = 0;
        $failed = 0;
        $deactivated = 0;
        $errors = [];

        DB::transaction(function () use ($rows, $stages, $batch, &$imported, &$updated, &$failed, &$deactivated, &$errors) {
            foreach ($rows as $i => $row) {
                $analysis = $this->analyze($row, $stages);
                if ($analysis['status'] === 'error') {
                    $failed++;
                    $errors[] = ['import_batch_id' => $batch->id, 'row_number' => $i + 1, 'message' => $analysis['message'], 'raw_data' => $row];

                    continue;
                }

                $stageId = $row['stage'] !== '' ? ($stages[$row['stage']] ?? null) : null;
                $gender = $row['gender'] !== '' ? (self::GENDERS[$row['gender']] ?? null) : null;

                $school = School::firstOrNew(['name' => $row['name']]);
                $isNew = ! $school->exists;
                $school->fill(array_filter([
                    'stage_id' => $stageId,
                    'gender' => $gender,
                    'email' => $row['email'] ?: null,
                ], fn ($v) => $v !== null));
                // المدرسة موجودة في الملف ⇒ نشطة (تُعاد تفعيلها إن كانت معطّلة).
                $school->is_active = true;
                $school->save();

                // مدير المدرسة لهذا العام (سجل تاريخي)
                if ($row['principal'] !== '') {
                    SchoolPrincipal::updateOrCreate(
                        ['school_id' => $school->id, 'academic_year_id' => $this->context->selectedYearId()],
                        ['name' => $row['principal']],
                    );
                }

                $isNew ? $imported++ : $updated++;
            }

            // مزامنة: تعطيل المدارس النشطة غير المذكورة في الملف (الملف هو الأساس).
            $names = $this->fileNames($rows);
            if ($names !== []) {
                $deactivated = School::whereNotIn('name', $names)->where('is_active', true)->update(['is_active' => false]);
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
            'summary' => ['imported' => $imported, 'updated' => $updated, 'failed' => $failed, 'deactivated' => $deactivated],
        ]);

        return $batch->fresh('errors');
    }

    /**
     * أسماء المدارس الفريدة المذكورة في الملف (لتحديد ما يبقى نشطًا في المزامنة).
     *
     * @return list<string>
     */
    private function fileNames(array $rows): array
    {
        return collect($rows)
            ->pluck('name')
            ->map(fn ($n) => trim((string) $n))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function analyze(array $row, $stages): array
    {
        if (($row['name'] ?? '') === '') {
            return ['status' => 'error', 'message' => 'اسم المدرسة مطلوب'];
        }
        if (($row['stage'] ?? '') !== '' && ! $stages->has($row['stage'])) {
            return ['status' => 'error', 'message' => 'المرحلة غير معروفة: '.$row['stage']];
        }
        if (($row['gender'] ?? '') !== '' && ! isset(self::GENDERS[$row['gender']])) {
            return ['status' => 'error', 'message' => 'النوع غير معروف: '.$row['gender']];
        }

        $exists = School::where('name', $row['name'])->exists();

        return $exists
            ? ['status' => 'update', 'message' => 'تحديث مدرسة موجودة']
            : ['status' => 'new', 'message' => 'مدرسة جديدة'];
    }
}
