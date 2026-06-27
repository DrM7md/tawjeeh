<?php

namespace Tests\Feature\Academic;

use App\Models\AcademicYear;
use App\Models\Role;
use App\Models\Semester;
use App\Models\User;
use App\Services\AcademicYearService;
use App\Services\SemesterService;
use App\Support\ActiveContext;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AcademicContextTest extends TestCase
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

    public function test_seeder_creates_one_active_year_and_semester(): void
    {
        $this->assertSame(1, AcademicYear::where('is_active', true)->count());
        $this->assertSame(1, Semester::where('is_active', true)->count());
    }

    public function test_activating_a_year_deactivates_others(): void
    {
        $service = app(AcademicYearService::class);
        $old = AcademicYear::where('is_active', true)->first();
        $new = AcademicYear::create(['name' => '2027–2028']);

        $service->activate($new);

        $this->assertFalse($old->fresh()->is_active);
        $this->assertTrue($new->fresh()->is_active);
        $this->assertSame(1, AcademicYear::where('is_active', true)->count());
    }

    public function test_activating_a_semester_deactivates_siblings(): void
    {
        $service = app(SemesterService::class);
        $year = AcademicYear::where('is_active', true)->first();
        $second = Semester::where('academic_year_id', $year->id)->where('is_active', false)->first();

        $service->activate($second);

        $this->assertTrue($second->fresh()->is_active);
        $this->assertSame(1, Semester::where('academic_year_id', $year->id)->where('is_active', true)->count());
    }

    public function test_active_context_defaults_to_active_year(): void
    {
        $context = app(ActiveContext::class);
        $activeYear = AcademicYear::where('is_active', true)->first();

        $this->assertSame($activeYear->id, $context->selectedYearId());
        $this->assertTrue($context->isEditable());
    }

    public function test_context_switch_route_changes_selected_year(): void
    {
        $other = AcademicYear::create(['name' => '2025–2026', 'is_active' => false]);

        $this->actingAs($this->admin)
            ->post('/context', ['year_id' => $other->id])
            ->assertRedirect();

        $this->assertEquals($other->id, session('context.year_id'));
    }

    public function test_only_authorized_users_can_create_years(): void
    {
        $supervisor = User::factory()->create();
        $supervisor->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);

        $this->actingAs($supervisor)
            ->post('/academic-years', ['name' => 'x'])
            ->assertForbidden();
    }

    public function test_creating_year_generates_default_semesters(): void
    {
        $this->actingAs($this->admin)
            ->post('/academic-years', ['name' => '2030–2031', 'generate_semesters' => true])
            ->assertRedirect();

        $year = AcademicYear::where('name', '2030–2031')->first();
        $this->assertSame(2, $year->semesters()->count());
    }

    public function test_academic_page_renders(): void
    {
        $this->actingAs($this->admin)
            ->get('/academic')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('academic/index')->has('years'));
    }
}
