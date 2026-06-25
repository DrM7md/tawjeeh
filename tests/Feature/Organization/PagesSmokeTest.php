<?php

namespace Tests\Feature\Organization;

use App\Models\Role;
use App\Models\User;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PagesSmokeTest extends TestCase
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

    public function test_departments_page_renders(): void
    {
        $this->actingAs($this->admin)
            ->get('/departments')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('organization/departments/index')->has('departments', 10));
    }

    public function test_users_page_renders(): void
    {
        $this->actingAs($this->admin)
            ->get('/users')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('organization/users/index')->has('roles', 4));
    }

    public function test_roles_page_renders(): void
    {
        $this->actingAs($this->admin)
            ->get('/roles')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('organization/roles/index')->has('permissionGroups'));
    }

    public function test_schools_page_renders(): void
    {
        $this->actingAs($this->admin)
            ->get('/schools')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('organization/schools/index')->has('stages', 3));
    }

    public function test_organization_settings_page_renders(): void
    {
        $this->actingAs($this->admin)
            ->get('/organization-settings')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('organization/settings/index')->has('stages', 3)->has('classifications', 3));
    }

    public function test_full_user_crud_flow(): void
    {
        $deptRole = Role::where('name', Permissions::ROLE_SUPERVISOR)->first();

        // إنشاء
        $this->actingAs($this->admin)->post('/users', [
            'name' => 'موجه تجريبي',
            'email' => 'sup@tawjeeh.test',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'is_active' => true,
            'role_ids' => [$deptRole->id],
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['email' => 'sup@tawjeeh.test']);
        $user = User::where('email', 'sup@tawjeeh.test')->first();
        $this->assertTrue($user->roles->contains($deptRole->id));

        // تعديل
        $this->actingAs($this->admin)->put("/users/{$user->id}", [
            'name' => 'موجه معدّل',
            'email' => 'sup@tawjeeh.test',
            'is_active' => true,
            'role_ids' => [$deptRole->id],
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'موجه معدّل']);

        // حذف
        $this->actingAs($this->admin)->delete("/users/{$user->id}")->assertRedirect();
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
    }
}
