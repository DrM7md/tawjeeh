<?php

namespace Tests\Feature\Schools;

use App\Models\Role;
use App\Models\School;
use App\Models\SchoolPrincipal;
use App\Models\User;
use App\Support\ActiveContext;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SchoolPrincipalTest extends TestCase
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

    public function test_creating_school_with_principal_records_year_scoped_entry(): void
    {
        $this->actingAs($this->admin)
            ->post('/schools', ['name' => 'مدرسة الأمل', 'principal' => 'أحمد علي', 'is_active' => true])
            ->assertRedirect();

        $school = School::where('name', 'مدرسة الأمل')->first();
        $yearId = app(ActiveContext::class)->selectedYearId();

        $this->assertSame('أحمد علي', SchoolPrincipal::where('school_id', $school->id)->where('academic_year_id', $yearId)->value('name'));
    }

    public function test_updating_principal_replaces_value(): void
    {
        $school = School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);

        $this->actingAs($this->admin)->put("/schools/{$school->id}", ['name' => 'مدرسة الأمل', 'principal' => 'محمد', 'is_active' => true]);
        $this->assertSame('محمد', SchoolPrincipal::where('school_id', $school->id)->value('name'));

        $this->actingAs($this->admin)->put("/schools/{$school->id}", ['name' => 'مدرسة الأمل', 'principal' => 'سعيد', 'is_active' => true]);
        $this->assertSame('سعيد', SchoolPrincipal::where('school_id', $school->id)->value('name'));
        $this->assertSame(1, SchoolPrincipal::count());
    }

    public function test_clearing_principal_removes_entry(): void
    {
        $school = School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);
        $this->actingAs($this->admin)->put("/schools/{$school->id}", ['name' => 'مدرسة الأمل', 'principal' => 'محمد', 'is_active' => true]);

        $this->actingAs($this->admin)->put("/schools/{$school->id}", ['name' => 'مدرسة الأمل', 'principal' => '', 'is_active' => true]);

        $this->assertSame(0, SchoolPrincipal::count());
    }

    public function test_principals_page_exposes_registry_to_manager(): void
    {
        $school = School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);
        $this->actingAs($this->admin)->put("/schools/{$school->id}", ['name' => 'مدرسة الأمل', 'principal' => 'محمد', 'is_active' => true]);

        $this->actingAs($this->admin)
            ->get('/principals')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('organization/principals/index')->has('principals', 1));
    }

    public function test_supervisor_cannot_view_principal_registry(): void
    {
        $supervisor = User::factory()->create();
        $supervisor->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);

        $this->actingAs($supervisor)->get('/principals')->assertForbidden();
    }
}
