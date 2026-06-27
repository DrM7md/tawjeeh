<?php

namespace App\Services\Import;

use App\Models\CoordinatorAssignment;
use App\Models\Department;
use App\Models\ImportBatch;
use App\Models\School;
use App\Models\SchoolPrincipal;
use App\Models\Stage;
use App\Models\Teacher;
use App\Support\ActiveContext;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * الاستيراد الموحّد: ملف Excel واحد يجمع (المدارس + الأقسام + المعلمين + تحديد المنسق) ويُستورد دفعة واحدة.
 *
 * منطق المزامنة (الملف هو الأساس) مطبَّق على مستوى كل مجموعة (مدرسة + قسم) مذكورة في الملف:
 * - المعلمون في الملف يُضافون/يُحدَّثون ويصبحون نشطين.
 * - معلم نشط في (مدرسة+قسم) مذكورة بالملف لكنه غائب عنه ⇒ يُعطَّل (لا يُحذف).
 * - مجموعات (مدرسة+قسم) غير المذكورة في الملف لا تُمَسّ إطلاقًا (حماية من التعطيل الشامل).
 *
 * تحديد المنسق: صف عليه «منسق=نعم» ⇒ يُنشأ/يُضمَن تكليف تنسيق نشط للمعلم بتاريخ التعيين.
 * الإلغاء (تنزيل المنسق) لا يتم عبر الاستيراد — بل من صفحة المنسقين فقط (حفظ السجل التاريخي).
 */
class UnifiedImportService
{
    use ReadsSpreadsheet;

    private const ALIASES = [
        // المدرسة
        'school' => ['اسم المدرسة', 'المدرسة'],
        'stage' => ['المرحلة'],
        'school_gender' => ['نوع المدرسة', 'النوع'],
        'school_email' => ['إيميل المدرسة', 'ايميل المدرسة'],
        'principal' => ['مدير المدرسة', 'المدير'],
        // القسم/المادة
        'department' => ['القسم', 'المادة', 'القسم/المادة'],
        // المعلم
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
        'email' => ['البريد الإلكتروني للمعلم', 'إيميل المعلم', 'البريد الإلكتروني'],
        'phone' => ['رقم الهاتف', 'الهاتف'],
        // التنسيق
        'is_coordinator' => ['منسق', 'منسق؟', 'منسق المادة'],
        'coordinator_start' => ['تاريخ التنسيق', 'تاريخ التعيين كمنسق', 'تاريخ بداية التنسيق'],
    ];

    private const TEACHER_GENDERS = ['ذكر' => 'male', 'أنثى' => 'female'];

    private const SCHOOL_GENDERS = ['بنين' => 'boys', 'بنات' => 'girls', 'مشترك' => 'mixed'];

    private const YES = ['نعم', 'منسق', 'صح', 'true', '1', 'x', '✓'];

    public function __construct(private readonly ActiveContext $context) {}

    /** @return list<array<string,string>> */
    public function parse(string $path): array
    {
        return $this->readRows($path, self::ALIASES);
    }

    /** معاينة بدون كتابة: حالة كل صف + ملخّص بالأعداد. */
    public function preview(array $rows): array
    {
        $stages = Stage::pluck('id', 'name');
        $departments = $this->departmentMap();

        $summary = [
            'teachers_new' => 0, 'teachers_update' => 0, 'coordinators' => 0,
            'schools' => 0, 'deactivate' => 0, 'error' => 0,
        ];
        $schoolNames = [];
        $preview = [];

        foreach ($rows as $i => $row) {
            $analysis = $this->analyze($row, $stages, $departments);
            $summary[$analysis['bucket']]++;
            if ($analysis['bucket'] !== 'error') {
                $schoolNames[$row['school']] = true;
                if ($this->isYes($row['is_coordinator'] ?? '')) {
                    $summary['coordinators']++;
                }
            }
            $preview[] = [
                'row' => $i + 1,
                'school' => $row['school'] ?? '',
                'department' => $row['department'] ?? '',
                'name' => $row['name'] ?? '',
                'national_id' => $row['national_id'] ?? '',
                'is_coordinator' => $this->isYes($row['is_coordinator'] ?? ''),
                'status' => $analysis['status'],
                'message' => $analysis['message'],
            ];
        }

        $summary['schools'] = count($schoolNames);
        $summary['deactivate'] = $this->countDeactivations($rows, $departments);

        return ['rows' => $preview, 'summary' => $summary, 'total' => count($rows)];
    }

    public function import(array $rows, string $filename, ?int $userId): ImportBatch
    {
        $stages = Stage::pluck('id', 'name');
        $schoolGenders = self::SCHOOL_GENDERS;
        $departments = $this->departmentMap();

        $batch = ImportBatch::create([
            'user_id' => $userId,
            'type' => 'unified',
            'original_filename' => $filename,
            'status' => 'processing',
            'total_rows' => count($rows),
        ]);

        $imported = 0;
        $updated = 0;
        $failed = 0;
        $deactivated = 0;
        $coordinators = 0;
        $errors = [];
        $touchedSchools = [];

        DB::transaction(function () use (
            $rows, $stages, $schoolGenders, $departments, $batch, $userId,
            &$imported, &$updated, &$failed, &$deactivated, &$coordinators, &$errors, &$touchedSchools
        ) {
            foreach ($rows as $i => $row) {
                $analysis = $this->analyze($row, $stages, $departments);
                if ($analysis['bucket'] === 'error') {
                    $failed++;
                    $errors[] = ['import_batch_id' => $batch->id, 'row_number' => $i + 1, 'message' => $analysis['message'], 'raw_data' => $row];

                    continue;
                }

                $departmentId = $departments[$this->norm($row['department'])];
                $school = $this->upsertSchool($row, $stages, $schoolGenders);
                $touchedSchools[$school->name] = true;
                $stageId = ($row['stage'] !== '' ? ($stages[$row['stage']] ?? null) : null) ?? $school->stage_id;

                $teacher = $this->upsertTeacher($row, $school, $departmentId, $stageId);
                $teacher->wasRecentlyCreated ? $imported++ : $updated++;

                // انتقال: تعطيل أي سجل نشط للشخص نفسه في مدرسة أخرى (نفس القسم).
                if (($row['national_id'] ?? '') !== '') {
                    $deactivated += Teacher::where('department_id', $departmentId)
                        ->where('national_id', $row['national_id'])
                        ->where('id', '!=', $teacher->id)
                        ->where('is_active', true)
                        ->update(['is_active' => false]);
                }

                if ($this->isYes($row['is_coordinator'] ?? '')) {
                    $this->ensureCoordinator($teacher, $school->id, $departmentId, $row['coordinator_start'] ?? '', $userId);
                    $coordinators++;
                }
            }

            // مزامنة: تعطيل معلمي كل مجموعة (مدرسة+قسم) مذكورة بالملف وغير الموجودين فيه.
            $deactivated += $this->syncDeactivate($rows, $departments);

            if (! empty($errors)) {
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
                'schools' => count($touchedSchools),
            ],
        ]);

        return $batch->fresh('errors');
    }

    /** يُنشئ/يُحدّث المدرسة (بالاسم) ويسجّل مديرها للعام المختار. */
    private function upsertSchool(array $row, $stages, array $schoolGenders): School
    {
        $school = School::firstOrNew(['name' => $row['school']]);
        $school->fill(array_filter([
            'stage_id' => $row['stage'] !== '' ? ($stages[$row['stage']] ?? null) : null,
            'gender' => $row['school_gender'] !== '' ? ($schoolGenders[$row['school_gender']] ?? null) : null,
            'email' => $row['school_email'] ?: null,
        ], fn ($v) => $v !== null));
        $school->is_active = true;
        $school->save();

        if (($row['principal'] ?? '') !== '') {
            SchoolPrincipal::updateOrCreate(
                ['school_id' => $school->id, 'academic_year_id' => $this->context->selectedYearId()],
                ['name' => $row['principal']],
            );
        }

        return $school;
    }

    /** يُنشئ/يُحدّث المعلم (مطابقة بالرقم الشخصي داخل المدرسة+القسم، وإلا بالاسم). */
    private function upsertTeacher(array $row, School $school, int $departmentId, ?int $stageId): Teacher
    {
        $attrs = [
            'school_id' => $school->id,
            'stage_id' => $stageId,
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
            ? ['department_id' => $departmentId, 'school_id' => $school->id, 'national_id' => $row['national_id']]
            : ['department_id' => $departmentId, 'school_id' => $school->id, 'name' => $row['name']];

        if ($row['national_id'] !== '') {
            $attrs['national_id'] = $row['national_id'];
        }

        return Teacher::updateOrCreate($key, $attrs);
    }

    /** يضمن وجود تكليف تنسيق نشط للمعلم في العام المختار (لا يُكرَّر، لا يُلغى). */
    private function ensureCoordinator(Teacher $teacher, int $schoolId, int $departmentId, string $startRaw, ?int $userId): void
    {
        $start = $this->parseDate($startRaw) ?? now()->toDateString();

        CoordinatorAssignment::updateOrCreate(
            ['teacher_id' => $teacher->id, 'status' => CoordinatorAssignment::STATUS_ACTIVE],
            [
                'school_id' => $schoolId,
                'department_id' => $departmentId,
                'start_date' => $start,
                'created_by' => $userId,
            ],
        );
    }

    /** يعطّل معلمي كل مجموعة (مدرسة+قسم) مذكورة بالملف ممّن لم يردوا فيه. @return int */
    private function syncDeactivate(array $rows, array $departments): int
    {
        $deactivated = 0;

        foreach ($this->groupBySchoolDept($rows, $departments) as $group) {
            [$schoolId, $departmentId, $nationalIds, $names] = $group;
            if ($nationalIds === [] && $names === []) {
                continue;
            }

            $deactivated += Teacher::where('school_id', $schoolId)
                ->where('department_id', $departmentId)
                ->where('is_active', true)
                ->when($nationalIds !== [], fn ($q) => $q->where(
                    fn ($q) => $q->whereNull('national_id')->orWhereNotIn('national_id', $nationalIds),
                ))
                ->whereNotIn('name', $names ?: ['__none__'])
                ->update(['is_active' => false]);
        }

        return $deactivated;
    }

    private function countDeactivations(array $rows, array $departments): int
    {
        $count = 0;
        foreach ($this->groupBySchoolDept($rows, $departments) as $group) {
            [$schoolId, $departmentId, $nationalIds, $names] = $group;
            if (($nationalIds === [] && $names === []) || $schoolId === null) {
                continue;
            }
            $count += Teacher::where('school_id', $schoolId)
                ->where('department_id', $departmentId)
                ->where('is_active', true)
                ->when($nationalIds !== [], fn ($q) => $q->where(
                    fn ($q) => $q->whereNull('national_id')->orWhereNotIn('national_id', $nationalIds),
                ))
                ->whereNotIn('name', $names ?: ['__none__'])
                ->count();
        }

        return $count;
    }

    /**
     * يجمّع صفوف الملف الصالحة حسب (مدرسة موجودة + قسم)، مرجِعًا الأرقام الشخصية والأسماء لكل مجموعة.
     *
     * @return list<array{0:int|null,1:int,2:list<string>,3:list<string>}>
     */
    private function groupBySchoolDept(array $rows, array $departments): array
    {
        $schoolIds = School::whereIn('name', collect($rows)->pluck('school')->filter()->unique())
            ->pluck('id', 'name');

        $groups = [];
        foreach ($rows as $row) {
            $deptKey = $this->norm($row['department'] ?? '');
            if (($row['school'] ?? '') === '' || ! isset($departments[$deptKey]) || ($row['name'] ?? '') === '') {
                continue;
            }
            $schoolId = $schoolIds[$row['school']] ?? null;
            if ($schoolId === null) {
                continue; // مدرسة جديدة لم تكن موجودة ⇒ لا يوجد ما يُعطَّل
            }
            $departmentId = $departments[$deptKey];
            $gk = $schoolId.'-'.$departmentId;
            $groups[$gk] ??= [$schoolId, $departmentId, [], []];
            if (($row['national_id'] ?? '') !== '') {
                $groups[$gk][2][] = $row['national_id'];
            }
            $groups[$gk][3][] = $row['name'];
        }

        return array_map(fn ($g) => [$g[0], $g[1], array_values(array_unique($g[2])), array_values(array_unique($g[3]))], array_values($groups));
    }

    private function analyze(array $row, $stages, array $departments): array
    {
        if (($row['school'] ?? '') === '') {
            return ['bucket' => 'error', 'status' => 'error', 'message' => 'اسم المدرسة مطلوب'];
        }
        if (($row['department'] ?? '') === '') {
            return ['bucket' => 'error', 'status' => 'error', 'message' => 'القسم/المادة مطلوب'];
        }
        if (! isset($departments[$this->norm($row['department'])])) {
            return ['bucket' => 'error', 'status' => 'error', 'message' => 'قسم غير معروف: '.$row['department']];
        }
        if (($row['name'] ?? '') === '') {
            return ['bucket' => 'error', 'status' => 'error', 'message' => 'اسم المعلم مطلوب'];
        }
        if (($row['stage'] ?? '') !== '' && ! $stages->has($row['stage'])) {
            return ['bucket' => 'error', 'status' => 'error', 'message' => 'المرحلة غير معروفة: '.$row['stage']];
        }
        if (($row['gender'] ?? '') !== '' && ! isset(self::TEACHER_GENDERS[$row['gender']])) {
            return ['bucket' => 'error', 'status' => 'error', 'message' => 'جنس المعلم غير صحيح (ذكر/أنثى): '.$row['gender']];
        }
        if (($row['school_gender'] ?? '') !== '' && ! isset(self::SCHOOL_GENDERS[$row['school_gender']])) {
            return ['bucket' => 'error', 'status' => 'error', 'message' => 'نوع المدرسة غير معروف (بنين/بنات/مشترك): '.$row['school_gender']];
        }

        $departmentId = $departments[$this->norm($row['department'])];
        $existsHere = ($row['national_id'] ?? '') !== ''
            && Teacher::whereHas('school', fn ($q) => $q->where('name', $row['school']))
                ->where('department_id', $departmentId)
                ->where('national_id', $row['national_id'])
                ->exists();

        return $existsHere
            ? ['bucket' => 'teachers_update', 'status' => 'update', 'message' => 'تحديث معلم موجود']
            : ['bucket' => 'teachers_new', 'status' => 'new', 'message' => 'معلم جديد'];
    }

    /** @return array<string,int> خريطة اسم القسم (مُطبَّع) => المعرّف. */
    private function departmentMap(): array
    {
        $map = [];
        foreach (Department::all(['id', 'name']) as $dept) {
            $map[$this->norm($dept->name)] = $dept->id;
        }

        return $map;
    }

    private function norm(string $value): string
    {
        return trim($value);
    }

    private function isYes(string $value): bool
    {
        return in_array(mb_strtolower(trim($value)), self::YES, true);
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
