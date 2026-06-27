<?php

namespace App\Services\Import;

use App\Models\ImportBatch;
use App\Models\School;
use App\Models\Stage;
use App\Models\Teacher;
use App\Support\ActiveContext;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * استيراد معلمي قسم محدّد في مدرسة محدّدة من Excel بمنطق المزامنة (الملف هو الأساس):
 * - المعلمون في الملف يُضافون/يُحدَّثون ويصبحون نشطين في هذه المدرسة.
 * - معلم كان في المدرسة واختفى من الملف (استقال/حُذف) ⇒ يصبح «غير نشط» (لا يُحذف).
 * - معلم ظهر برقمه الشخصي في مدرسة أخرى ⇒ يُفعَّل هناك ويُعطَّل في القديمة (انتقال).
 * - عودته بعد أعوام = سجل جديد تلقائيًا (لكل عام دراسي سجلّه المستقل).
 */
class TeacherImportService
{
    use ReadsSpreadsheet;

    private const ALIASES = [
        'name' => ['اسم الموظف', 'اسم المعلم', 'المعلم'],
        'employee_no' => ['الرقم الوظيفي'],
        'national_id' => ['الرقم الشخصي'],
        'gender' => ['الجنس'],
        'nationality' => ['الجنسية'],
        'birth_date' => ['تاريخ الميلاد'],
        'school' => ['اسم المدرسة', 'المدرسة'],
        'school_type' => ['نوع المدرسة'],
        'stage' => ['المرحلة'],
        'job_title' => ['المسمى الوظيفي'],
        'academic_degree' => ['الدرجة العلمية'],
        'specialization' => ['التخصص العلمي'],
        'hire_date' => ['تاريخ التعيين في الوزارة', 'تاريخ التعيين'],
        'license_level' => ['مستوى الرخصة المهنية', 'مستوى الرخصة'],
        'license_year' => ['سنة الحصول على الرخصة', 'سنة الرخصة'],
        'residential_zone' => ['المنطقة السكنية'],
        'email' => ['البريد الإلكتروني', 'الإيميل'],
        'phone' => ['رقم الهاتف', 'الهاتف'],
    ];

    private const GENDERS = ['ذكر' => 'male', 'أنثى' => 'female'];

    public function __construct(private readonly ActiveContext $context) {}

    /** @return list<array<string,string>> */
    public function parse(string $path): array
    {
        return $this->readRows($path, self::ALIASES);
    }

    public function preview(array $rows, School $school, int $departmentId): array
    {
        $summary = ['new' => 0, 'update' => 0, 'error' => 0, 'deactivate' => 0];
        $preview = [];

        foreach ($rows as $i => $row) {
            $analysis = $this->analyze($row, $school, $departmentId);
            $summary[$analysis['status']]++;
            $preview[] = [
                'row' => $i + 1,
                'name' => $row['name'] ?? '',
                'national_id' => $row['national_id'] ?? '',
                'employee_no' => $row['employee_no'] ?? '',
                'job_title' => $row['job_title'] ?? '',
                'specialization' => $row['specialization'] ?? '',
                'status' => $analysis['status'],
                'message' => $analysis['message'],
            ];
        }

        // عدد معلمي هذه المدرسة+القسم النشطين غير المذكورين في الملف (سيُعطَّلون).
        $absent = $this->absentTeachersQuery($school, $departmentId, $rows);
        $summary['deactivate'] = $absent ? $absent->count() : 0;

        return ['rows' => $preview, 'summary' => $summary, 'total' => count($rows)];
    }

    public function import(array $rows, School $school, int $departmentId, string $filename, ?int $userId): ImportBatch
    {
        $stages = Stage::pluck('id', 'name');

        $batch = ImportBatch::create([
            'user_id' => $userId,
            'type' => 'teachers',
            'school_id' => $school->id,
            'department_id' => $departmentId,
            'original_filename' => $filename,
            'status' => 'processing',
            'total_rows' => count($rows),
        ]);

        $imported = 0;
        $updated = 0;
        $failed = 0;
        $deactivated = 0;
        $errors = [];

        DB::transaction(function () use ($rows, $school, $departmentId, $stages, $batch, &$imported, &$updated, &$failed, &$deactivated, &$errors) {
            foreach ($rows as $i => $row) {
                $analysis = $this->analyze($row, $school, $departmentId);
                if ($analysis['status'] === 'error') {
                    $failed++;
                    $errors[] = ['import_batch_id' => $batch->id, 'row_number' => $i + 1, 'message' => $analysis['message'], 'raw_data' => $row];

                    continue;
                }

                $stageId = ($row['stage'] !== '' ? ($stages[$row['stage']] ?? null) : null) ?? $school->stage_id;

                $attrs = [
                    'school_id' => $school->id,
                    'stage_id' => $stageId,
                    'name' => $row['name'],
                    'employee_no' => $row['employee_no'] ?: null,
                    'gender' => $row['gender'] !== '' ? (self::GENDERS[$row['gender']] ?? null) : null,
                    'nationality' => $row['nationality'] ?: null,
                    'birth_date' => $this->parseDate($row['birth_date']),
                    'job_title' => $row['job_title'] ?: null,
                    'academic_degree' => $row['academic_degree'] ?: null,
                    'specialization' => $row['specialization'] ?: null,
                    'ministry_hire_date' => $this->parseDate($row['hire_date']),
                    'license_level' => $row['license_level'] ?: null,
                    'license_year' => $row['license_year'] ?: null,
                    'residential_zone' => $row['residential_zone'] ?: null,
                    'email' => $row['email'] ?: null,
                    'phone' => $row['phone'] ?: null,
                    'is_active' => true, // الوجود في الملف ⇒ نشط (يُعاد تفعيله إن كان معطّلًا)
                ];

                // المطابقة ضمن نفس المدرسة (سجل مستقل لكل مدرسة لحفظ تاريخ الانتقال).
                $key = $row['national_id'] !== ''
                    ? ['department_id' => $departmentId, 'school_id' => $school->id, 'national_id' => $row['national_id']]
                    : ['department_id' => $departmentId, 'school_id' => $school->id, 'name' => $row['name']];

                if ($row['national_id'] !== '') {
                    $attrs['national_id'] = $row['national_id'];
                }

                $teacher = Teacher::updateOrCreate($key, $attrs);
                $teacher->wasRecentlyCreated ? $imported++ : $updated++;

                // انتقال: تعطيل أي سجل نشط للشخص نفسه في مدرسة أخرى (الشخص بمدرسة واحدة).
                if ($row['national_id'] !== '') {
                    $deactivated += Teacher::where('department_id', $departmentId)
                        ->where('national_id', $row['national_id'])
                        ->where('id', '!=', $teacher->id)
                        ->where('is_active', true)
                        ->update(['is_active' => false]);
                }
            }

            // مزامنة: تعطيل معلمي هذه المدرسة+القسم النشطين غير المذكورين في الملف.
            $absent = $this->absentTeachersQuery($school, $departmentId, $rows);
            if ($absent) {
                $deactivated += $absent->update(['is_active' => false]);
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

    private function analyze(array $row, School $school, int $departmentId): array
    {
        if (($row['name'] ?? '') === '') {
            return ['status' => 'error', 'message' => 'اسم الموظف مطلوب'];
        }
        if (($row['gender'] ?? '') !== '' && ! isset(self::GENDERS[$row['gender']])) {
            return ['status' => 'error', 'message' => 'الجنس غير صحيح (ذكر/أنثى): '.$row['gender']];
        }

        if (($row['national_id'] ?? '') !== '') {
            $existsHere = Teacher::where('department_id', $departmentId)
                ->where('school_id', $school->id)
                ->where('national_id', $row['national_id'])
                ->exists();
            if ($existsHere) {
                return ['status' => 'update', 'message' => 'تحديث معلم موجود (مطابقة بالرقم الشخصي)'];
            }

            $movedFromElsewhere = Teacher::where('department_id', $departmentId)
                ->where('national_id', $row['national_id'])
                ->where('school_id', '!=', $school->id)
                ->where('is_active', true)
                ->exists();
            if ($movedFromElsewhere) {
                return ['status' => 'new', 'message' => 'معلم منقول من مدرسة أخرى'];
            }
        }

        return ['status' => 'new', 'message' => 'معلم جديد'];
    }

    /**
     * استعلام معلمي (المدرسة+القسم) النشطين غير المذكورين في الملف — للمزامنة/المعاينة.
     * يُرجع null عند عدم وجود أي صفوف صالحة (حماية من تعطيل القائمة بالكامل).
     */
    private function absentTeachersQuery(School $school, int $departmentId, array $rows): ?\Illuminate\Database\Eloquent\Builder
    {
        $nationalIds = $this->fileValues($rows, 'national_id');
        $names = $this->fileValues($rows, 'name');

        if ($nationalIds === [] && $names === []) {
            return null;
        }

        return Teacher::where('school_id', $school->id)
            ->where('department_id', $departmentId)
            ->where('is_active', true)
            ->when($nationalIds !== [], fn ($q) => $q->where(
                fn ($q) => $q->whereNull('national_id')->orWhereNotIn('national_id', $nationalIds),
            ))
            ->whereNotIn('name', $names ?: ['__none__']);
    }

    /** @return list<string> القيم الفريدة غير الفارغة لعمود ما في صفوف الملف. */
    private function fileValues(array $rows, string $key): array
    {
        return collect($rows)
            ->pluck($key)
            ->map(fn ($v) => trim((string) $v))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /** يحوّل قيمة تاريخ (نصية أو رقم Excel تسلسلي) إلى Y-m-d أو null. */
    private function parseDate(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        if (is_numeric($value)) {
            try {
                return ExcelDate::excelToDateTimeObject((float) $value)->format('Y-m-d');
            } catch (\Throwable) {
                return null;
            }
        }

        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }
}
