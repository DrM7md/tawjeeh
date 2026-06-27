<?php

namespace App\Services\Import;

use App\Models\ClassificationRecord;
use App\Models\CoordinatorAssignment;
use App\Models\ImportBatch;
use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use App\Services\ClassificationService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * استيراد «كشف المعلمين» (منفصل عن استيراد المدارس):
 * - يشير لمدرسة نشطة موجودة فقط (مطابقة بالاسم المطبَّع) — اسم غير مطابق = خطأ، ولا تُنشأ مدرسة.
 * - مقيّد بقسم واحد (قسم رافع الملف) — لا عمود «قسم» في الكشف.
 * - يقرأ «التقييم السنوي» ويطبّع رمز النسبة، ثم يشتقّ التصنيف آليًا عبر محرك التصنيف.
 * - «منسق=نعم» يُنشئ تكليف تنسيق نشطًا.
 * - مزامنة: معلمو (مدرسة) مذكورة بالملف وغائبون عنه يُعطَّلون (لا يُحذفون).
 */
class RosterImportService
{
    use ReadsSpreadsheet;

    private const ALIASES = [
        'school' => ['المدرسة', 'اسم المدرسة'],
        'name' => ['اسم المعلم', 'اسم الموظف', 'المعلم'],
        'national_id' => ['الرقم الشخصي'],
        'employee_no' => ['الرقم الوظيفي'],
        'gender' => ['الجنس'],
        'nationality' => ['الجنسية'],
        'birth_date' => ['تاريخ الميلاد'],
        'job_title' => ['المسمى الوظيفي'],
        'academic_degree' => ['الدرجة العلمية'],
        'specialization' => ['التخصص العلمي'],
        'hire_date' => ['تاريخ التعيين في الوزارة', 'تاريخ التعيين'],
        'license_level' => ['مستوى الرخصة المهنية', 'مستوى الرخصة'],
        'license_year' => ['سنة الحصول على الرخصة', 'سنة الرخصة'],
        'residential_zone' => ['المنطقة السكنية'],
        'email' => ['البريد الإلكتروني للمعلم', 'البريد الإلكتروني', 'إيميل المعلم'],
        'phone' => ['رقم الهاتف', 'الهاتف'],
        'annual_eval' => ['التقييم السنوي %', 'التقييم السنوي', 'التقييم'],
        'is_coordinator' => ['منسق؟', 'منسق', 'منسق المادة'],
        'coordinator_start' => ['تاريخ التنسيق', 'تاريخ التعيين كمنسق', 'تاريخ بداية التنسيق'],
    ];

    private const TEACHER_GENDERS = ['ذكر' => 'male', 'أنثى' => 'female'];

    private const YES = ['نعم', 'منسق', 'صح', 'true', '1', 'x', '✓'];

    public function __construct(
        private readonly ClassificationService $classifier,
    ) {}

    /** @return list<array<string,string>> */
    public function parse(string $path): array
    {
        // نتجاهل الصفوف الخالية من بيانات فعلية — صفوف القالب غير المملوءة قد تبدو «غير فارغة»
        // للقارئ بسبب معادلة التصنيف، فنفلترها بناءً على الحقول المعنيّة فقط.
        $rows = $this->readRows($path, self::ALIASES);

        return array_values(array_filter($rows, fn ($r) => $this->rowHasContent($r)));
    }

    private function rowHasContent(array $row): bool
    {
        foreach ($row as $value) {
            if (trim((string) $value) !== '') {
                return true;
            }
        }

        return false;
    }

    /** معاينة بدون كتابة: حالة كل صف + التصنيف المشتقّ + ملخّص. */
    public function preview(array $rows, int $departmentId): array
    {
        $schoolMap = $this->schoolMap();

        $summary = [
            'teachers_new' => 0, 'teachers_update' => 0, 'coordinators' => 0,
            'schools' => 0, 'classified' => 0, 'deactivate' => 0, 'error' => 0,
        ];
        $matchedSchools = [];
        $preview = [];

        foreach ($rows as $i => $row) {
            $a = $this->analyze($row, $schoolMap, $departmentId);
            $summary[$a['bucket']]++;

            $isCoordinator = $this->isYes($row['is_coordinator'] ?? '');
            if ($a['bucket'] !== 'error') {
                $matchedSchools[$a['school_id']] = true;
                if ($isCoordinator) {
                    $summary['coordinators']++;
                }
                if ($a['classification'] !== null) {
                    $summary['classified']++;
                }
            }

            $preview[] = [
                'row' => $i + 1,
                'school' => $row['school'] ?? '',
                'name' => $row['name'] ?? '',
                'national_id' => $row['national_id'] ?? '',
                'annual_eval' => $row['annual_eval'] ?? '',
                'classification' => $a['classification'],
                'is_coordinator' => $isCoordinator,
                'status' => $a['status'],
                'message' => $a['message'],
            ];
        }

        $summary['schools'] = count($matchedSchools);
        $summary['deactivate'] = $this->countDeactivations($rows, $departmentId, $schoolMap);

        return ['rows' => $preview, 'summary' => $summary, 'total' => count($rows)];
    }

    public function import(array $rows, int $departmentId, string $filename, User $actor): ImportBatch
    {
        $schoolMap = $this->schoolMap();

        $batch = ImportBatch::create([
            'user_id' => $actor->id,
            'type' => 'roster',
            'department_id' => $departmentId,
            'original_filename' => $filename,
            'status' => 'processing',
            'total_rows' => count($rows),
        ]);

        $imported = 0;
        $updated = 0;
        $failed = 0;
        $deactivated = 0;
        $coordinators = 0;
        $classified = 0;
        $errors = [];
        $touchedSchools = [];

        DB::transaction(function () use (
            $rows, $departmentId, $schoolMap, $batch, $actor,
            &$imported, &$updated, &$failed, &$deactivated, &$coordinators, &$classified, &$errors, &$touchedSchools
        ) {
            foreach ($rows as $i => $row) {
                $a = $this->analyze($row, $schoolMap, $departmentId);
                if ($a['bucket'] === 'error') {
                    $failed++;
                    $errors[] = ['import_batch_id' => $batch->id, 'row_number' => $i + 1, 'message' => $a['message'], 'raw_data' => $row];

                    continue;
                }

                $schoolId = $a['school_id'];
                $touchedSchools[$schoolId] = true;

                $teacher = $this->upsertTeacher($row, $schoolId, $departmentId);
                $teacher->wasRecentlyCreated ? $imported++ : $updated++;

                // انتقال: تعطيل أي سجل نشط للشخص نفسه في مدرسة أخرى (نفس القسم).
                if (($row['national_id'] ?? '') !== '') {
                    $deactivated += Teacher::where('department_id', $departmentId)
                        ->where('national_id', $row['national_id'])
                        ->where('id', '!=', $teacher->id)
                        ->where('is_active', true)
                        ->update(['is_active' => false]);
                }

                // اشتقاق التصنيف من التقييم السنوي واعتماده (يصبح تصنيف المعلم الفعّال).
                if ($this->classify($teacher, $a['percent'], $actor)) {
                    $classified++;
                }

                if ($this->isYes($row['is_coordinator'] ?? '')) {
                    $this->ensureCoordinator($teacher, $schoolId, $departmentId, $row['coordinator_start'] ?? '', $actor->id);
                    $coordinators++;
                }
            }

            $deactivated += $this->syncDeactivate($rows, $departmentId, $schoolMap);

            if ($errors !== []) {
                $batch->errors()->createMany($errors);
            }
        });

        $batch->update([
            'status' => 'completed',
            'imported_rows' => $imported,
            'updated_rows' => $updated,
            'failed_rows' => $failed,
            'summary' => [
                'imported' => $imported, 'updated' => $updated, 'failed' => $failed,
                'deactivated' => $deactivated, 'coordinators' => $coordinators,
                'classified' => $classified, 'schools' => count($touchedSchools),
            ],
        ]);

        return $batch->fresh('errors');
    }

    /* ===================== مساعدات ===================== */

    /** تحليل صف: يطابق المدرسة، يتحقّق من التقييم، ويشتقّ التصنيف. */
    private function analyze(array $row, array $schoolMap, int $departmentId): array
    {
        if (($row['school'] ?? '') === '') {
            return $this->err('اسم المدرسة مطلوب');
        }
        $school = $this->matchSchool($row['school'], $schoolMap);
        if ($school === null) {
            return $this->err('مدرسة غير موجودة في النظام — استوردها أولًا: '.$row['school']);
        }
        if (($row['name'] ?? '') === '') {
            return $this->err('اسم المعلم مطلوب');
        }
        if (($row['gender'] ?? '') !== '' && ! isset(self::TEACHER_GENDERS[$row['gender']])) {
            return $this->err('جنس المعلم غير صحيح (ذكر/أنثى): '.$row['gender']);
        }

        // التقييم السنوي: فارغ ⇒ معلم جديد (تصنيف افتراضي)، وغير صالح ⇒ خطأ.
        $percent = null;
        if (trim($row['annual_eval'] ?? '') !== '') {
            $percent = $this->parsePercent($row['annual_eval']);
            if ($percent === null) {
                return $this->err('قيمة التقييم السنوي غير صالحة: '.$row['annual_eval']);
            }
        }

        $category = $this->classifier->categorize($percent, $percent === null);

        $existsHere = ($row['national_id'] ?? '') !== ''
            && Teacher::where('department_id', $departmentId)
                ->where('school_id', $school['id'])
                ->where('national_id', $row['national_id'])
                ->exists();

        return [
            'bucket' => $existsHere ? 'teachers_update' : 'teachers_new',
            'status' => $existsHere ? 'update' : 'new',
            'message' => $existsHere ? 'تحديث معلم موجود' : 'معلم جديد',
            'school_id' => $school['id'],
            'percent' => $percent,
            'classification' => $category?->name,
        ];
    }

    private function err(string $message): array
    {
        return ['bucket' => 'error', 'status' => 'error', 'message' => $message,
            'school_id' => null, 'percent' => null, 'classification' => null];
    }

    /** يُنشئ/يُحدّث المعلم (مطابقة بالرقم الشخصي داخل المدرسة+القسم، وإلا بالاسم). */
    private function upsertTeacher(array $row, int $schoolId, int $departmentId): Teacher
    {
        $attrs = [
            'name' => $row['name'],
            'employee_no' => $row['employee_no'] ?: null,
            'gender' => $row['gender'] !== '' ? (self::TEACHER_GENDERS[$row['gender']] ?? null) : null,
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
            'is_active' => true,
        ];

        $key = $row['national_id'] !== ''
            ? ['department_id' => $departmentId, 'school_id' => $schoolId, 'national_id' => $row['national_id']]
            : ['department_id' => $departmentId, 'school_id' => $schoolId, 'name' => $row['name']];

        if ($row['national_id'] !== '') {
            $attrs['national_id'] = $row['national_id'];
        }

        return Teacher::updateOrCreate($key, $attrs);
    }

    /** يشتقّ تصنيف المعلم من التقييم السنوي ويعتمده (يصبح تصنيفه الفعّال). @return bool هل صُنّف؟ */
    private function classify(Teacher $teacher, ?float $percent, User $actor): bool
    {
        $record = $this->classifier->classify($teacher, [
            'stage' => ClassificationRecord::STAGE_INITIAL,
            'basis' => ClassificationRecord::BASIS_ANNUAL,
            'score' => $percent,
            'is_new' => $percent === null,
            'note' => 'مشتقّ من التقييم السنوي عبر استيراد الكشف',
        ], $actor, autoApprove: true);

        return $record->teacher_classification_id !== null;
    }

    /** يضمن وجود تكليف تنسيق نشط للمعلم في العام المختار. */
    private function ensureCoordinator(Teacher $teacher, int $schoolId, int $departmentId, string $startRaw, ?int $userId): void
    {
        CoordinatorAssignment::updateOrCreate(
            ['teacher_id' => $teacher->id, 'status' => CoordinatorAssignment::STATUS_ACTIVE],
            [
                'school_id' => $schoolId,
                'department_id' => $departmentId,
                'start_date' => $this->parseDate($startRaw) ?? now()->toDateString(),
                'created_by' => $userId,
            ],
        );
    }

    /** يعطّل معلمي كل مدرسة مذكورة بالملف ممّن لم يردوا فيها (ضمن القسم). @return int */
    private function syncDeactivate(array $rows, int $departmentId, array $schoolMap): int
    {
        $deactivated = 0;
        foreach ($this->groupBySchool($rows, $schoolMap) as [$schoolId, $nationalIds, $names]) {
            if ($nationalIds === [] && $names === []) {
                continue;
            }
            $deactivated += Teacher::where('school_id', $schoolId)
                ->where('department_id', $departmentId)
                ->where('is_active', true)
                ->when($nationalIds !== [], fn ($q) => $q->where(
                    fn ($w) => $w->whereNull('national_id')->orWhereNotIn('national_id', $nationalIds),
                ))
                ->whereNotIn('name', $names ?: ['__none__'])
                ->update(['is_active' => false]);
        }

        return $deactivated;
    }

    private function countDeactivations(array $rows, int $departmentId, array $schoolMap): int
    {
        $count = 0;
        foreach ($this->groupBySchool($rows, $schoolMap) as [$schoolId, $nationalIds, $names]) {
            if ($nationalIds === [] && $names === []) {
                continue;
            }
            $count += Teacher::where('school_id', $schoolId)
                ->where('department_id', $departmentId)
                ->where('is_active', true)
                ->when($nationalIds !== [], fn ($q) => $q->where(
                    fn ($w) => $w->whereNull('national_id')->orWhereNotIn('national_id', $nationalIds),
                ))
                ->whereNotIn('name', $names ?: ['__none__'])
                ->count();
        }

        return $count;
    }

    /**
     * يجمّع صفوف الملف الصالحة حسب المدرسة (مطابَقة)، مرجِعًا الأرقام الشخصية والأسماء لكل مدرسة.
     *
     * @return list<array{0:int,1:list<string>,2:list<string>}>
     */
    private function groupBySchool(array $rows, array $schoolMap): array
    {
        $groups = [];
        foreach ($rows as $row) {
            if (($row['name'] ?? '') === '' || ($row['school'] ?? '') === '') {
                continue;
            }
            $school = $this->matchSchool($row['school'], $schoolMap);
            if ($school === null) {
                continue;
            }
            $sid = $school['id'];
            $groups[$sid] ??= [$sid, [], []];
            if (($row['national_id'] ?? '') !== '') {
                $groups[$sid][1][] = $row['national_id'];
            }
            $groups[$sid][2][] = $row['name'];
        }

        return array_map(
            fn ($g) => [$g[0], array_values(array_unique($g[1])), array_values(array_unique($g[2]))],
            array_values($groups),
        );
    }

    /** خريطة المدارس النشطة: الاسم المطبَّع => [id, name]. @return array<string,array{id:int,name:string}> */
    private function schoolMap(): array
    {
        $map = [];
        foreach (School::where('is_active', true)->get(['id', 'name']) as $s) {
            $map[$this->normName($s->name)] = ['id' => $s->id, 'name' => $s->name];
        }

        return $map;
    }

    private function matchSchool(string $raw, array $schoolMap): ?array
    {
        return $schoolMap[$this->normName($raw)] ?? null;
    }

    /** تطبيع اسم المدرسة للمطابقة: مسافات + توحيد الألف/الهمزة/التاء المربوطة/الألف المقصورة. */
    private function normName(string $value): string
    {
        $value = trim(preg_replace('/\s+/u', ' ', $value));
        $value = str_replace(['أ', 'إ', 'آ', 'ٱ'], 'ا', $value);
        $value = str_replace('ة', 'ه', $value);
        $value = str_replace('ى', 'ي', $value);

        return str_replace('ـ', '', $value); // حذف التطويل
    }

    /** يطبّع التقييم لنسبة 0..100: يحذف % و٪، يحوّل الأرقام العربية والكسر 0.92، ويقصّ المدى. */
    private function parsePercent(string $raw): ?float
    {
        $v = str_replace(['%', '٪', ' '], '', $this->normalizeDigits(trim($raw)));
        $v = str_replace(',', '.', $v);
        if ($v === '' || ! is_numeric($v)) {
            return null;
        }
        $f = (float) $v;
        if ($f > 0 && $f <= 1) {
            $f *= 100; // أُدخلت ككسر (0.92)
        }

        return max(0.0, min(100.0, $f));
    }

    private function normalizeDigits(string $s): string
    {
        $from = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        $to = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

        return str_replace($from, $to, $s);
    }

    private function isYes(string $value): bool
    {
        return in_array(mb_strtolower(trim($value)), self::YES, true);
    }

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
