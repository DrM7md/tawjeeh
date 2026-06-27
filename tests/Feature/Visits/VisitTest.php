<?php

namespace Tests\Feature\Visits;

use App\Models\Coordinator;
use App\Models\Department;
use App\Models\Role;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\TeacherClassification;
use App\Models\User;
use App\Services\VisitService;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VisitTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Department $dept;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ReferenceDataSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->roles()->sync([Role::where('name', Permissions::ROLE_HEAD)->first()->id]);
        $this->dept = Department::first();
    }

    private function supervisor(): User
    {
        $u = User::factory()->create(['department_id' => $this->dept->id]);
        $u->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);

        return $u->fresh();
    }

    public function test_record_creates_visit_with_context(): void
    {
        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id]);
        $this->actingAs($this->admin);

        $visit = app(VisitService::class)->record([
            'visit_type' => 'teacher',
            'visitable_id' => $teacher->id,
            'school_id' => $teacher->school_id,
            'department_id' => $this->dept->id,
            'visit_date' => '2026-10-01',
        ]);

        $this->assertNotNull($visit->academic_year_id);
        $this->assertNotNull($visit->semester_id);
        $this->assertSame(Teacher::class, $visit->visitable_type);
    }

    public function test_teacher_status_remaining_until_required_met(): void
    {
        $this->actingAs($this->admin);
        $needsSupport = TeacherClassification::where('code', 'needs_support')->first(); // 3 زيارات
        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id, 'classification_id' => $needsSupport->id]);
        $service = app(VisitService::class);

        $payload = ['visit_type' => 'teacher', 'visitable_id' => $teacher->id, 'school_id' => $teacher->school_id, 'department_id' => $this->dept->id, 'visit_date' => '2026-10-01'];

        $service->record($payload);
        $target = collect($service->followUp($this->admin)['targets'])->firstWhere('id', $teacher->id);
        $this->assertSame('remaining', $target['status']);
        $this->assertSame(1, $target['done_year']);

        $service->record($payload);
        $service->record($payload);
        $target = collect($service->followUp($this->admin)['targets'])->firstWhere('id', $teacher->id);
        $this->assertSame('done', $target['status']);
        $this->assertSame(3, $target['done_year']);
    }

    public function test_coordinator_requires_one_visit(): void
    {
        $this->actingAs($this->admin);
        $coordinator = Coordinator::factory()->create(['department_id' => $this->dept->id]);
        $service = app(VisitService::class);

        $target = collect($service->followUp($this->admin)['targets'])->firstWhere(fn ($t) => $t['type'] === 'coordinator' && $t['id'] === $coordinator->id);
        $this->assertSame('remaining', $target['status']);
        $this->assertSame(1, $target['required']);

        $service->record(['visit_type' => 'coordinator', 'visitable_id' => $coordinator->id, 'school_id' => $coordinator->school_id, 'department_id' => $this->dept->id, 'visit_date' => '2026-10-02']);
        $target = collect($service->followUp($this->admin)['targets'])->firstWhere(fn ($t) => $t['type'] === 'coordinator' && $t['id'] === $coordinator->id);
        $this->assertSame('done', $target['status']);
    }

    public function test_form_draft_then_final_locks_for_non_finalizer(): void
    {
        $sup = $this->supervisor();
        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id]);
        SchoolAssignment::create(['school_id' => $teacher->school_id, 'supervisor_id' => $sup->id, 'department_id' => $this->dept->id, 'assignment_method' => 'manual']);
        $this->actingAs($sup);
        $visit = app(VisitService::class)->record(['visit_type' => 'teacher', 'visitable_id' => $teacher->id, 'school_id' => $teacher->school_id, 'department_id' => $this->dept->id, 'visit_date' => '2026-10-01']);

        // مسودة (الموجه يملك forms.fill)
        $this->post("/visits/{$visit->id}/form", ['save_status' => 'draft', 'axes' => ['التخطيط' => 4], 'notes' => 'جيد'])->assertRedirect();
        $this->assertDatabaseHas('visit_forms', ['visit_id' => $visit->id, 'save_status' => 'draft']);

        // الموجه يملك forms.finalize (من الافتراضات) → يعتمد
        $this->post("/visits/{$visit->id}/form", ['save_status' => 'final'])->assertRedirect();
        $this->assertDatabaseHas('visit_forms', ['visit_id' => $visit->id, 'save_status' => 'final']);
    }

    public function test_supervisor_cannot_record_for_unassigned_school(): void
    {
        $sup = $this->supervisor();
        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id]); // غير مسندة

        $this->actingAs($sup)
            ->post('/visits', ['teacher_id' => $teacher->id, 'visit_date' => '2026-10-01'])
            ->assertForbidden();
    }

    public function test_supervisor_sees_only_own_visits(): void
    {
        $sup = $this->supervisor();
        $other = $this->supervisor();
        $t1 = Teacher::factory()->create(['department_id' => $this->dept->id]);
        $t2 = Teacher::factory()->create(['department_id' => $this->dept->id]);

        $this->actingAs($sup);
        app(VisitService::class)->record(['visit_type' => 'teacher', 'visitable_id' => $t1->id, 'school_id' => $t1->school_id, 'department_id' => $this->dept->id, 'visit_date' => '2026-10-01']);
        $this->actingAs($other);
        app(VisitService::class)->record(['visit_type' => 'teacher', 'visitable_id' => $t2->id, 'school_id' => $t2->school_id, 'department_id' => $this->dept->id, 'visit_date' => '2026-10-01']);

        $this->assertCount(1, app(VisitService::class)->list($sup));
        $this->assertCount(2, app(VisitService::class)->list($this->admin));
    }

    public function test_file_upload_is_stored_privately(): void
    {
        Storage::fake('local');
        $sup = $this->supervisor();
        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id]);
        SchoolAssignment::create(['school_id' => $teacher->school_id, 'supervisor_id' => $sup->id, 'department_id' => $this->dept->id, 'assignment_method' => 'manual']);
        $this->actingAs($sup);
        $visit = app(VisitService::class)->record(['visit_type' => 'teacher', 'visitable_id' => $teacher->id, 'school_id' => $teacher->school_id, 'department_id' => $this->dept->id, 'visit_date' => '2026-10-01']);

        $this->post("/visits/{$visit->id}/files", ['file' => UploadedFile::fake()->create('report.pdf', 100)])->assertRedirect();

        $this->assertSame(1, $visit->form->files()->count());
        Storage::disk('local')->assertExists($visit->form->files()->first()->path);
    }

    public function test_head_sees_departments_board(): void
    {
        $this->actingAs($this->admin)
            ->get('/visits')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('visits/index')->where('view', 'departments')->has('departments'));
    }

    public function test_head_can_drill_into_department_supervisors(): void
    {
        $this->supervisor();

        $this->actingAs($this->admin)
            ->get('/visits?department='.$this->dept->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('visits/index')
                ->where('view', 'supervisors')
                ->where('department.id', $this->dept->id)
                ->has('supervisors'));
    }

    public function test_drilling_into_supervisor_shows_their_visits(): void
    {
        $sup = $this->supervisor();

        $this->actingAs($this->admin)
            ->get('/visits?supervisor='.$sup->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('visits/index')
                ->where('view', 'visits')
                ->where('supervisor.id', $sup->id)
                ->has('followUp')
                ->has('visits'));
    }

    public function test_supervisor_sees_own_visits_board(): void
    {
        $sup = $this->supervisor();

        $this->actingAs($sup)
            ->get('/visits')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('visits/index')
                ->where('view', 'visits')
                ->where('supervisor', null)
                ->has('followUp')
                ->has('visits'));
    }

    public function test_department_head_cannot_view_other_department_supervisor(): void
    {
        $otherDept = Department::create(['name' => 'قسم آخر', 'is_active' => true]);
        $foreignSup = User::factory()->create(['department_id' => $otherDept->id]);
        $foreignSup->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);

        $head = User::factory()->create(['department_id' => $this->dept->id]);
        $head->roles()->sync([Role::where('name', Permissions::ROLE_DEPARTMENT_HEAD)->first()->id]);

        $this->actingAs($head->fresh())
            ->get('/visits?supervisor='.$foreignSup->id)
            ->assertForbidden();
    }
}
