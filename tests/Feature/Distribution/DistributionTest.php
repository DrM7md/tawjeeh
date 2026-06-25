<?php

namespace Tests\Feature\Distribution;

use App\Actions\DistributeSchoolsAction;
use App\Models\Department;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolAssignment;
use App\Models\User;
use App\Services\DistributionService;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DistributionTest extends TestCase
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

    private function makeSupervisors(int $count): array
    {
        $role = Role::where('name', Permissions::ROLE_SUPERVISOR)->first();
        $ids = [];
        for ($i = 0; $i < $count; $i++) {
            $u = User::factory()->create(['department_id' => $this->dept->id]);
            $u->roles()->sync([$role->id]);
            $ids[] = $u->id;
        }

        return $ids;
    }

    public function test_algorithm_balances_load_least_loaded_first(): void
    {
        $action = new DistributeSchoolsAction;
        // 4 مدارس متساوية الوزن على موجهين → 2 لكل واحد
        $weights = [1 => 1, 2 => 1, 3 => 1, 4 => 1];
        $result = $action->handle($weights, [10, 20]);

        $counts = array_count_values(array_values($result));
        $this->assertEquals(2, $counts[10]);
        $this->assertEquals(2, $counts[20]);
    }

    public function test_algorithm_returns_empty_without_supervisors(): void
    {
        $this->assertSame([], (new DistributeSchoolsAction)->handle([1 => 5], []));
    }

    public function test_auto_preview_distributes_unassigned_schools(): void
    {
        $this->makeSupervisors(2);
        School::factory()->count(6)->create(['is_active' => true]);

        $preview = app(DistributionService::class)->autoDistributePreview($this->dept->id, 'all');

        $this->assertCount(6, $preview['assignments']);
    }

    public function test_assign_is_unique_per_school_department_year(): void
    {
        [$s1, $s2] = $this->makeSupervisors(2);
        $school = School::factory()->create();
        $service = app(DistributionService::class);

        $service->assign($school->id, $s1, $this->dept->id);
        $service->assign($school->id, $s2, $this->dept->id); // إعادة إسناد لنفس المدرسة

        $this->assertSame(1, SchoolAssignment::where('school_id', $school->id)->where('department_id', $this->dept->id)->count());
        $this->assertSame($s2, SchoolAssignment::where('school_id', $school->id)->first()->supervisor_id);
    }

    public function test_overview_counts_assigned_and_unassigned(): void
    {
        [$s1] = $this->makeSupervisors(1);
        $schools = School::factory()->count(3)->create();
        app(DistributionService::class)->assign($schools[0]->id, $s1, $this->dept->id);

        $overview = app(DistributionService::class)->overview($this->dept->id);

        $this->assertSame(1, $overview['totals']['assigned']);
        $this->assertCount(2, $overview['unassigned']);
    }

    public function test_distribution_page_renders_for_admin(): void
    {
        $this->actingAs($this->admin)
            ->get('/distribution')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('distribution/index')->has('departments'));
    }

    public function test_department_head_cannot_distribute_other_department(): void
    {
        $head = User::factory()->create(['department_id' => $this->dept->id]);
        $head->roles()->sync([Role::where('name', Permissions::ROLE_DEPARTMENT_HEAD)->first()->id]);
        $otherDept = Department::where('id', '!=', $this->dept->id)->first();
        $school = School::factory()->create();
        [$sup] = $this->makeSupervisors(1);

        $this->actingAs($head)
            ->post('/distribution/assign', ['department_id' => $otherDept->id, 'school_id' => $school->id, 'supervisor_id' => $sup])
            ->assertForbidden();
    }

    public function test_supervisor_cannot_view_distribution(): void
    {
        $sup = User::factory()->create(['department_id' => $this->dept->id]);
        $sup->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);

        $this->actingAs($sup)->get('/distribution')->assertForbidden();
    }
}
