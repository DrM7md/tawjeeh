<?php

namespace Tests\Feature\Dashboard;

use App\Models\Department;
use App\Models\Role;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\User;
use App\Services\IndicatorService;
use App\Services\VisitService;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IndicatorTest extends TestCase
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

    private function userWithRole(string $role): User
    {
        $u = User::factory()->create(['department_id' => $this->dept->id]);
        $u->roles()->sync([Role::where('name', $role)->first()->id]);

        return $u->fresh();
    }

    public function test_head_gets_global_dashboard(): void
    {
        $this->actingAs($this->admin);
        $dash = app(IndicatorService::class)->dashboard($this->admin);

        $this->assertSame('global', $dash['scope']);
        $this->assertArrayHasKey('departmentPerformance', $dash);
        $this->assertSame(10, $dash['cards']['departments']);
    }

    public function test_department_head_gets_department_dashboard(): void
    {
        $head = $this->userWithRole(Permissions::ROLE_DEPARTMENT_HEAD);
        $this->actingAs($head);

        $dash = app(IndicatorService::class)->dashboard($head);

        $this->assertSame('department', $dash['scope']);
        $this->assertSame($this->dept->name, $dash['department']);
    }

    public function test_supervisor_gets_supervisor_dashboard(): void
    {
        $sup = $this->userWithRole(Permissions::ROLE_SUPERVISOR);
        $this->actingAs($sup);

        $dash = app(IndicatorService::class)->dashboard($sup);

        $this->assertSame('supervisor', $dash['scope']);
    }

    public function test_completion_reflects_recorded_visits(): void
    {
        $this->actingAs($this->admin);
        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id]); // required 1 (لا تصنيف)

        $before = app(IndicatorService::class)->dashboard($this->admin)['cards']['completion'];
        $this->assertSame(0.0, (float) $before);

        app(VisitService::class)->record([
            'visit_type' => 'teacher', 'visitable_id' => $teacher->id,
            'school_id' => $teacher->school_id, 'department_id' => $this->dept->id, 'visit_date' => '2026-10-01',
        ]);

        $after = app(IndicatorService::class)->dashboard($this->admin)['cards']['completion'];
        $this->assertSame(100.0, (float) $after);
    }

    public function test_dashboard_page_renders(): void
    {
        $this->actingAs($this->admin)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('dashboard')->has('dashboard.cards'));
    }
}
