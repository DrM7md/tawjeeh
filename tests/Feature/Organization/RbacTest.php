<?php

namespace Tests\Feature\Organization;

use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ReferenceDataSeeder::class);
    }

    private function makeUser(string $roleName): User
    {
        $user = User::factory()->create();
        $role = Role::where('name', $roleName)->first();
        $user->roles()->sync([$role->id]);

        return $user->fresh();
    }

    public function test_guests_are_redirected_to_login(): void
    {
        $this->get('/users')->assertRedirect('/login');
    }

    public function test_head_of_guidance_can_access_user_management(): void
    {
        $this->actingAs($this->makeUser(Permissions::ROLE_HEAD))
            ->get('/users')->assertOk();
    }

    public function test_supervisor_cannot_access_user_management(): void
    {
        $this->actingAs($this->makeUser(Permissions::ROLE_SUPERVISOR))
            ->get('/users')->assertForbidden();
    }

    public function test_supervisor_cannot_access_role_management(): void
    {
        $this->actingAs($this->makeUser(Permissions::ROLE_SUPERVISOR))
            ->get('/roles')->assertForbidden();
    }

    public function test_department_head_can_view_schools(): void
    {
        $this->actingAs($this->makeUser(Permissions::ROLE_DEPARTMENT_HEAD))
            ->get('/schools')->assertOk();
    }

    public function test_supervisor_cannot_create_schools(): void
    {
        $this->actingAs($this->makeUser(Permissions::ROLE_SUPERVISOR))
            ->post('/schools', ['name' => 'مدرسة اختبار', 'is_active' => true])
            ->assertForbidden();
    }

    public function test_head_can_create_department(): void
    {
        $this->actingAs($this->makeUser(Permissions::ROLE_HEAD))
            ->post('/departments', ['name' => 'قسم جديد', 'is_active' => true])
            ->assertRedirect();

        $this->assertDatabaseHas('departments', ['name' => 'قسم جديد']);
    }

    public function test_system_role_cannot_be_deleted(): void
    {
        $admin = $this->makeUser(Permissions::ROLE_HEAD);
        $systemRole = Role::where('name', Permissions::ROLE_SUPERVISOR)->first();

        $this->actingAs($admin)->delete("/roles/{$systemRole->id}");

        $this->assertDatabaseHas('roles', ['id' => $systemRole->id]);
    }

    public function test_permission_union_and_super_flag(): void
    {
        $admin = $this->makeUser(Permissions::ROLE_HEAD);
        $this->assertTrue($admin->isSuper());
        $this->assertTrue($admin->hasPermission('users.create'));

        $supervisor = $this->makeUser(Permissions::ROLE_SUPERVISOR);
        $this->assertFalse($supervisor->isSuper());
        $this->assertFalse($supervisor->hasPermission('users.create'));
        $this->assertTrue($supervisor->hasPermission('visits.create'));
    }
}
