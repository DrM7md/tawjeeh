<?php

namespace Tests\Feature\Import;

use App\Models\Department;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolAssignment;
use App\Models\SchoolPrincipal;
use App\Models\Teacher;
use App\Models\User;
use App\Services\Import\SchoolImportService;
use App\Services\Import\TeacherImportService;
use App\Support\ActiveContext;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ImportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ReferenceDataSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->roles()->sync([Role::where('name', Permissions::ROLE_HEAD)->first()->id]);
    }

    private function csv(string $header, array $rows): string
    {
        $body = collect($rows)->map(fn ($r) => implode(',', $r))->implode("\n");
        $path = tempnam(sys_get_temp_dir(), 'imp').'.csv';
        file_put_contents($path, "\xEF\xBB\xBF".$header."\n".$body);

        return $path;
    }

    private function schoolCsv(array $rows): string
    {
        return $this->csv('اسم المدرسة,المرحلة,النوع,إيميل المدرسة,مدير المدرسة', $rows);
    }

    private function teacherCsv(array $rows): string
    {
        return $this->csv('اسم الموظف,الرقم الشخصي,الجنس,المسمى الوظيفي,التخصص العلمي', $rows);
    }

    /* ===================== استيراد المدارس ===================== */

    public function test_school_import_creates_school_and_year_scoped_principal(): void
    {
        $path = $this->schoolCsv([
            ['مدرسة الأمل', 'إعدادي', 'بنين', 'amal@moe.edu', 'أحمد علي'],
            ['مدرسة النور', 'ثانوي', 'بنات', 'noor@moe.edu', 'سعاد محمد'],
            ['', 'إعدادي', 'بنين', '', 'بلا اسم'], // خطأ: اسم فارغ
        ]);
        $service = app(SchoolImportService::class);

        $batch = $service->import($service->parse($path), 'schools.csv', $this->admin->id);

        $this->assertSame(2, $batch->imported_rows);
        $this->assertSame(1, $batch->failed_rows);
        $this->assertSame(2, School::count());

        $school = School::where('name', 'مدرسة الأمل')->first();
        $this->assertSame('boys', $school->gender);
        $this->assertSame('amal@moe.edu', $school->email);

        $yearId = app(ActiveContext::class)->selectedYearId();
        $this->assertSame('أحمد علي', SchoolPrincipal::where('school_id', $school->id)->where('academic_year_id', $yearId)->value('name'));
    }

    public function test_school_reimport_updates_principal_not_duplicates(): void
    {
        $service = app(SchoolImportService::class);
        $service->import($service->parse($this->schoolCsv([['مدرسة الأمل', 'إعدادي', 'بنين', '', 'أحمد']])), 'a.csv', $this->admin->id);
        $batch2 = $service->import($service->parse($this->schoolCsv([['مدرسة الأمل', 'إعدادي', 'بنين', '', 'محمد']])), 'b.csv', $this->admin->id);

        $this->assertSame(0, $batch2->imported_rows);
        $this->assertSame(1, $batch2->updated_rows);
        $this->assertSame(1, School::count());
        $this->assertSame(1, SchoolPrincipal::count());
        $this->assertSame('محمد', SchoolPrincipal::first()->name);
    }

    /* ===================== استيراد المعلمين ===================== */

    public function test_teacher_import_is_idempotent_by_national_id(): void
    {
        $school = School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);
        $dept = Department::where('name', 'التربية الإسلامية')->first();
        $service = app(TeacherImportService::class);

        $service->import($service->parse($this->teacherCsv([['محمد أحمد', '784199012345', 'ذكر', 'معلم', 'دراسات إسلامية']])), $school, $dept->id, 't1.csv', $this->admin->id);
        // إعادة الاستيراد بتخصّص مختلف ونفس الرقم الشخصي
        $batch2 = $service->import($service->parse($this->teacherCsv([['محمد أحمد', '784199012345', 'ذكر', 'منسق', 'شريعة']])), $school, $dept->id, 't2.csv', $this->admin->id);

        $this->assertSame(0, $batch2->imported_rows);
        $this->assertSame(1, $batch2->updated_rows);
        $this->assertSame(1, Teacher::count());

        $teacher = Teacher::first();
        $this->assertSame('male', $teacher->gender);
        $this->assertSame('منسق', $teacher->job_title);
        $this->assertSame('شريعة', $teacher->specialization);
        $this->assertTrue($teacher->is_active);
    }

    public function test_teacher_reimport_deactivates_absent_teacher(): void
    {
        $school = School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);
        $dept = Department::where('name', 'التربية الإسلامية')->first();
        $service = app(TeacherImportService::class);

        $service->import($service->parse($this->teacherCsv([
            ['محمد أحمد', '111', 'ذكر', 'معلم', 'دراسات إسلامية'],
            ['سعيد علي', '222', 'ذكر', 'معلم', 'دراسات إسلامية'],
        ])), $school, $dept->id, 't1.csv', $this->admin->id);

        // إعادة الاستيراد بدون «سعيد» ⇒ يصبح غير نشط (لا يُحذف)
        $batch = $service->import($service->parse($this->teacherCsv([
            ['محمد أحمد', '111', 'ذكر', 'معلم', 'دراسات إسلامية'],
        ])), $school, $dept->id, 't2.csv', $this->admin->id);

        $this->assertSame(1, $batch->summary['deactivated']);
        $this->assertSame(2, Teacher::count());
        $this->assertTrue(Teacher::where('national_id', '111')->first()->is_active);
        $this->assertFalse(Teacher::where('national_id', '222')->first()->is_active);
    }

    public function test_empty_teacher_file_does_not_deactivate(): void
    {
        $school = School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);
        $dept = Department::where('name', 'التربية الإسلامية')->first();
        $service = app(TeacherImportService::class);

        $service->import($service->parse($this->teacherCsv([
            ['محمد أحمد', '111', 'ذكر', 'معلم', 'دراسات إسلامية'],
        ])), $school, $dept->id, 't1.csv', $this->admin->id);

        $empty = $this->csv('اسم الموظف,الرقم الشخصي,الجنس,المسمى الوظيفي,التخصص العلمي', []);
        $batch = $service->import($service->parse($empty), $school, $dept->id, 'empty.csv', $this->admin->id);

        $this->assertSame(0, $batch->summary['deactivated']);
        $this->assertTrue(Teacher::where('national_id', '111')->first()->is_active);
    }

    public function test_teacher_transfer_keeps_old_record_inactive_with_destination(): void
    {
        $dept = Department::where('name', 'التربية الإسلامية')->first();
        $schoolA = School::create(['name' => 'مدرسة أ', 'is_active' => true]);
        $schoolB = School::create(['name' => 'مدرسة ب', 'is_active' => true]);
        $service = app(TeacherImportService::class);

        $row = [['محمد أحمد', '111', 'ذكر', 'معلم', 'دراسات إسلامية']];
        $service->import($service->parse($this->teacherCsv($row)), $schoolA, $dept->id, 'a.csv', $this->admin->id);
        $service->import($service->parse($this->teacherCsv($row)), $schoolB, $dept->id, 'b.csv', $this->admin->id);

        $this->assertSame(2, Teacher::count()); // سجل مستقل لكل مدرسة
        $this->assertFalse(Teacher::where('school_id', $schoolA->id)->first()->is_active);
        $this->assertTrue(Teacher::where('school_id', $schoolB->id)->first()->is_active);

        // صفحة المدرسة (أ) تُظهر وجهة الانتقال للمعلم غير النشط
        SchoolAssignment::create([
            'school_id' => $schoolA->id,
            'department_id' => $dept->id,
            'supervisor_id' => $this->admin->id,
            'assignment_method' => 'manual',
        ]);
        $props = app(\App\Services\SchoolPagePresenter::class)->props($schoolA, $this->admin);
        $inactive = collect($props['teachers'])->firstWhere('is_active', false);
        $this->assertSame('مدرسة ب', $inactive->transferred_to);
    }

    public function test_returning_teacher_reactivates_in_school(): void
    {
        $school = School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);
        $dept = Department::where('name', 'التربية الإسلامية')->first();
        $service = app(TeacherImportService::class);

        $full = [
            ['محمد أحمد', '111', 'ذكر', 'معلم', 'دراسات إسلامية'],
            ['سعيد علي', '222', 'ذكر', 'معلم', 'دراسات إسلامية'],
        ];
        $service->import($service->parse($this->teacherCsv($full)), $school, $dept->id, 't1.csv', $this->admin->id);
        $service->import($service->parse($this->teacherCsv([
            ['محمد أحمد', '111', 'ذكر', 'معلم', 'دراسات إسلامية'],
        ])), $school, $dept->id, 't2.csv', $this->admin->id);
        $this->assertFalse(Teacher::where('national_id', '222')->first()->is_active);

        // عودته في ملف لاحق ⇒ يُعاد تفعيله بلا تكرار
        $batch = $service->import($service->parse($this->teacherCsv($full)), $school, $dept->id, 't3.csv', $this->admin->id);
        $this->assertTrue(Teacher::where('national_id', '222')->first()->is_active);
        $this->assertSame(2, Teacher::count());
        $this->assertSame(0, $batch->imported_rows);
        $this->assertSame(2, $batch->updated_rows);
    }

    /* ===================== الصفحات والصلاحيات ===================== */

    public function test_school_show_page_renders(): void
    {
        $school = School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);

        $this->actingAs($this->admin)
            ->get("/schools/{$school->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('organization/schools/show')->has('teachers')->has('grades'));
    }

    public function test_school_template_and_export_download(): void
    {
        School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);

        $this->actingAs($this->admin)->get('/schools-template')->assertOk();
        $this->actingAs($this->admin)->get('/schools-export')->assertOk();
    }

    public function test_unassigned_supervisor_cannot_import_teachers(): void
    {
        $dept = Department::where('name', 'التربية الإسلامية')->first();
        $supervisor = User::factory()->create(['department_id' => $dept->id]);
        $supervisor->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);
        $school = School::create(['name' => 'مدرسة بعيدة', 'is_active' => true]);

        $this->actingAs($supervisor)
            ->post("/schools/{$school->id}/teachers/import/preview", ['file' => UploadedFile::fake()->create('x.xlsx', 10)])
            ->assertForbidden();
    }

    public function test_assigned_supervisor_can_preview_teacher_import(): void
    {
        $dept = Department::where('name', 'التربية الإسلامية')->first();
        $supervisor = User::factory()->create(['department_id' => $dept->id]);
        $supervisor->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);
        $school = School::create(['name' => 'مدرسة مُسندة', 'is_active' => true]);

        SchoolAssignment::create([
            'school_id' => $school->id,
            'department_id' => $dept->id,
            'supervisor_id' => $supervisor->id,
            'assignment_method' => 'manual',
        ]);

        $content = \Maatwebsite\Excel\Facades\Excel::raw(new \App\Exports\TeachersTemplateExport, \Maatwebsite\Excel\Excel::XLSX);
        $file = UploadedFile::fake()->createWithContent('teachers.xlsx', $content);

        $this->actingAs($supervisor)
            ->post("/schools/{$school->id}/teachers/import/preview", ['file' => $file])
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('organization/schools/show')->has('teacherImport'));
    }
}
