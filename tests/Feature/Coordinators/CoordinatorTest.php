<?php

namespace Tests\Feature\Coordinators;

use App\Models\CoordinatorAssignment;
use App\Models\Department;
use App\Models\Role;
use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use App\Services\Import\UnifiedImportService;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoordinatorTest extends TestCase
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

    private function unifiedCsv(array $rows): string
    {
        $header = 'اسم المدرسة,المرحلة,نوع المدرسة,مدير المدرسة,القسم,اسم المعلم,الرقم الشخصي,الجنس,منسق,تاريخ التنسيق';
        $body = collect($rows)->map(fn ($r) => implode(',', $r))->implode("\n");
        $path = tempnam(sys_get_temp_dir(), 'uni').'.csv';
        file_put_contents($path, "\xEF\xBB\xBF".$header."\n".$body);

        return $path;
    }

    /* ===================== الاستيراد الموحّد ===================== */

    public function test_unified_import_creates_schools_teachers_and_marks_coordinator(): void
    {
        $dept = 'التربية الإسلامية';
        $path = $this->unifiedCsv([
            ['مدرسة الأمل', 'إعدادي', 'بنين', 'أحمد مدير', $dept, 'محمد أحمد', '111', 'ذكر', 'لا', ''],
            ['مدرسة الأمل', 'إعدادي', 'بنين', 'أحمد مدير', $dept, 'سعيد علي', '222', 'ذكر', 'نعم', '2022-09-01'],
            ['', 'إعدادي', 'بنين', '', $dept, 'بلا مدرسة', '333', 'ذكر', 'لا', ''], // خطأ
        ]);

        $service = app(UnifiedImportService::class);
        $batch = $service->import($service->parse($path), 'unified.csv', $this->admin->id);

        $this->assertSame(2, $batch->imported_rows);
        $this->assertSame(1, $batch->failed_rows);
        $this->assertSame(1, School::count());
        $this->assertSame(2, Teacher::count());

        $this->assertSame(1, CoordinatorAssignment::active()->count());
        $coordinator = CoordinatorAssignment::active()->with('teacher')->first();
        $this->assertSame('سعيد علي', $coordinator->teacher->name);
        $this->assertSame('2022-09-01', $coordinator->start_date->toDateString());
        $this->assertSame(1, $batch->summary['coordinators']);
        $this->assertSame(1, $batch->summary['schools']);
    }

    public function test_unified_import_unknown_department_is_an_error(): void
    {
        $path = $this->unifiedCsv([
            ['مدرسة الأمل', 'إعدادي', 'بنين', '', 'قسم غير موجود', 'محمد', '111', 'ذكر', 'لا', ''],
        ]);

        $service = app(UnifiedImportService::class);
        $batch = $service->import($service->parse($path), 'unified.csv', $this->admin->id);

        $this->assertSame(0, $batch->imported_rows);
        $this->assertSame(1, $batch->failed_rows);
        $this->assertSame(0, Teacher::count());
    }

    public function test_unified_reimport_does_not_remove_existing_coordinator(): void
    {
        $service = app(UnifiedImportService::class);
        $dept = 'التربية الإسلامية';

        $service->import($service->parse($this->unifiedCsv([
            ['مدرسة الأمل', 'إعدادي', 'بنين', '', $dept, 'سعيد علي', '222', 'ذكر', 'نعم', '2022-09-01'],
        ])), 'a.csv', $this->admin->id);

        // إعادة الاستيراد بدون تعليم «منسق» لا تُلغي التكليف (الإلغاء من صفحة المنسقين فقط)
        $service->import($service->parse($this->unifiedCsv([
            ['مدرسة الأمل', 'إعدادي', 'بنين', '', $dept, 'سعيد علي', '222', 'ذكر', 'لا', ''],
        ])), 'b.csv', $this->admin->id);

        $this->assertSame(1, CoordinatorAssignment::active()->count());
    }

    /* ===================== مدة التنسيق ===================== */

    public function test_tenure_is_computed_from_start_date(): void
    {
        $assignment = $this->makeCoordinator(start: now()->subMonths(14)->toDateString());

        $this->assertSame(14, $assignment->tenureMonths());
        $this->assertStringContainsString('سنة', $assignment->tenureLabel());
    }

    public function test_ended_assignment_tenure_uses_end_date(): void
    {
        $assignment = $this->makeCoordinator(start: '2022-01-01');
        $assignment->update(['end_date' => '2023-01-01', 'status' => CoordinatorAssignment::STATUS_ENDED]);

        $this->assertSame(12, $assignment->fresh()->tenureMonths());
    }

    /* ===================== التنزيل كمعلم ===================== */

    public function test_demote_closes_assignment_but_keeps_teacher_and_history(): void
    {
        $assignment = $this->makeCoordinator();
        $teacherId = $assignment->teacher_id;

        $this->actingAs($this->admin)
            ->post("/coordinators/{$assignment->id}/demote", ['ended_reason' => 'قرار الإدارة'])
            ->assertRedirect();

        $assignment->refresh();
        $this->assertSame(CoordinatorAssignment::STATUS_ENDED, $assignment->status);
        $this->assertSame(now()->toDateString(), $assignment->end_date->toDateString());
        $this->assertSame('قرار الإدارة', $assignment->ended_reason);

        // السجل التاريخي محفوظ، والمعلم باقٍ نشطًا
        $this->assertDatabaseHas('coordinator_assignments', ['id' => $assignment->id]);
        $teacher = Teacher::find($teacherId);
        $this->assertNotNull($teacher);
        $this->assertTrue($teacher->is_active);
        $this->assertNull($teacher->fresh()->load('activeCoordinatorAssignment')->activeCoordinatorAssignment);
    }

    public function test_demote_twice_is_rejected(): void
    {
        $assignment = $this->makeCoordinator();
        $assignment->update(['status' => CoordinatorAssignment::STATUS_ENDED, 'end_date' => now()->toDateString()]);

        $this->actingAs($this->admin)
            ->post("/coordinators/{$assignment->id}/demote")
            ->assertStatus(422);
    }

    /* ===================== الصفحة والصلاحيات ===================== */

    public function test_coordinators_page_renders(): void
    {
        $this->makeCoordinator();

        $this->actingAs($this->admin)
            ->get('/coordinators')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('coordinators/index')->has('coordinators', 1));
    }

    public function test_supervisor_can_view_but_not_demote(): void
    {
        $supervisor = User::factory()->create();
        $supervisor->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);
        $assignment = $this->makeCoordinator();

        $this->actingAs($supervisor)->get('/coordinators')->assertOk();
        $this->actingAs($supervisor)->post("/coordinators/{$assignment->id}/demote")->assertForbidden();
    }

    public function test_export_downloads(): void
    {
        $this->makeCoordinator();

        $this->actingAs($this->admin)->get('/coordinators-export')->assertOk();
    }

    public function test_roster_import_page_and_template(): void
    {
        $this->actingAs($this->admin)->get('/roster-import')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('import/index')->has('batches'));

        $this->actingAs($this->admin)->get('/roster-import/template')->assertOk();
    }

    private function makeCoordinator(string $start = '2023-09-01'): CoordinatorAssignment
    {
        $dept = Department::where('name', 'التربية الإسلامية')->first();
        $school = School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);
        $teacher = Teacher::create([
            'school_id' => $school->id,
            'department_id' => $dept->id,
            'name' => 'سعيد علي',
            'national_id' => '222',
            'is_active' => true,
        ]);

        return CoordinatorAssignment::create([
            'teacher_id' => $teacher->id,
            'school_id' => $school->id,
            'department_id' => $dept->id,
            'start_date' => $start,
            'status' => CoordinatorAssignment::STATUS_ACTIVE,
            'created_by' => $this->admin->id,
        ]);
    }
}
