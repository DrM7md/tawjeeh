<?php

namespace Tests\Feature\System;

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuditTest extends TestCase
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

    public function test_create_update_delete_are_logged(): void
    {
        $this->actingAs($this->admin);

        $dept = Department::create(['name' => 'قسم مدقَّق', 'is_active' => true]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'created', 'auditable_type' => Department::class, 'auditable_id' => $dept->id]);

        $dept->update(['name' => 'قسم معدّل']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'updated', 'auditable_id' => $dept->id]);

        $id = $dept->id;
        $dept->delete();
        $this->assertDatabaseHas('audit_logs', ['action' => 'deleted', 'auditable_id' => $id]);
    }

    public function test_password_is_scrubbed_from_user_audit(): void
    {
        $this->actingAs($this->admin);
        $user = User::create(['name' => 'سرّي', 'email' => 'secret@t.test', 'password' => Hash::make('password')]);

        $log = AuditLog::where('auditable_type', User::class)->where('auditable_id', $user->id)->where('action', 'created')->first();
        $this->assertNotNull($log);
        $this->assertArrayNotHasKey('password', $log->new_values ?? []);
    }

    public function test_login_is_logged_and_updates_last_login(): void
    {
        $user = User::factory()->create(['password' => Hash::make('password123'), 'is_active' => true]);

        $this->post('/login', ['email' => $user->email, 'password' => 'password123'])->assertRedirect();

        $this->assertDatabaseHas('audit_logs', ['action' => 'login', 'user_id' => $user->id]);
        $this->assertNotNull($user->fresh()->last_login_at);
    }

    public function test_audit_page_requires_permission(): void
    {
        $this->actingAs($this->admin)->get('/audit')->assertOk();

        $sup = User::factory()->create();
        $sup->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);
        $this->actingAs($sup)->get('/audit')->assertForbidden();
    }

    public function test_backup_page_requires_permission(): void
    {
        $this->actingAs($this->admin)
            ->get('/backups')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('backup/index')->has('backups'));

        $sup = User::factory()->create();
        $sup->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);
        $this->actingAs($sup)->get('/backups')->assertForbidden();
    }
}
