<?php

namespace Tests\Feature\Notifications;

use App\Models\Department;
use App\Models\NotificationSetting;
use App\Models\Role;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\User;
use App\Notifications\NotificationType;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private Department $dept;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ReferenceDataSeeder::class);
        $this->dept = Department::first();
    }

    private function withRole(string $role, array $attrs = []): User
    {
        $u = User::factory()->create($attrs);
        $u->roles()->sync([Role::where('name', $role)->first()->id]);

        return $u->fresh();
    }

    public function test_department_head_is_notified_when_supervisor_records_visit(): void
    {
        $head = $this->withRole(Permissions::ROLE_DEPARTMENT_HEAD, ['department_id' => $this->dept->id]);
        $supervisor = $this->withRole(Permissions::ROLE_SUPERVISOR, ['department_id' => $this->dept->id]);

        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id]);
        SchoolAssignment::create([
            'school_id' => $teacher->school_id,
            'supervisor_id' => $supervisor->id,
            'department_id' => $this->dept->id,
            'assignment_method' => 'manual',
        ]);

        $this->actingAs($supervisor)
            ->post('/visits', ['visit_type' => 'teacher', 'visitable_id' => $teacher->id, 'visit_date' => '2026-10-01'])
            ->assertRedirect();

        // رئيس القسم يستلم؛ الموجّه المُنشئ لا يستلم.
        $this->assertSame(1, $head->fresh()->unreadNotifications()->count());
        $this->assertSame(0, $supervisor->fresh()->unreadNotifications()->count());

        $payload = $head->fresh()->notifications()->first()->data;
        $this->assertSame(NotificationType::VISIT_ASSIGNED, $payload['type']);
    }

    public function test_head_in_other_department_is_not_notified_when_scoped(): void
    {
        $otherDept = Department::create(['name' => 'قسم آخر', 'is_active' => true]);
        $otherHead = $this->withRole(Permissions::ROLE_DEPARTMENT_HEAD, ['department_id' => $otherDept->id]);
        $supervisor = $this->withRole(Permissions::ROLE_SUPERVISOR, ['department_id' => $this->dept->id]);

        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id]);
        SchoolAssignment::create([
            'school_id' => $teacher->school_id,
            'supervisor_id' => $supervisor->id,
            'department_id' => $this->dept->id,
            'assignment_method' => 'manual',
        ]);

        $this->actingAs($supervisor)
            ->post('/visits', ['visit_type' => 'teacher', 'visitable_id' => $teacher->id, 'visit_date' => '2026-10-01'])
            ->assertRedirect();

        $this->assertSame(0, $otherHead->fresh()->unreadNotifications()->count());
    }

    public function test_disabled_type_sends_nothing(): void
    {
        NotificationSetting::create([
            'type' => NotificationType::VISIT_ASSIGNED,
            'enabled' => false,
            'recipient_roles' => [Permissions::ROLE_DEPARTMENT_HEAD],
            'department_scoped' => true,
            'live' => false,
        ]);

        $head = $this->withRole(Permissions::ROLE_DEPARTMENT_HEAD, ['department_id' => $this->dept->id]);
        $supervisor = $this->withRole(Permissions::ROLE_SUPERVISOR, ['department_id' => $this->dept->id]);

        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id]);
        SchoolAssignment::create([
            'school_id' => $teacher->school_id,
            'supervisor_id' => $supervisor->id,
            'department_id' => $this->dept->id,
            'assignment_method' => 'manual',
        ]);

        $this->actingAs($supervisor)
            ->post('/visits', ['visit_type' => 'teacher', 'visitable_id' => $teacher->id, 'visit_date' => '2026-10-01'])
            ->assertRedirect();

        $this->assertSame(0, $head->fresh()->unreadNotifications()->count());
    }

    public function test_settings_page_renders_for_admin(): void
    {
        $admin = $this->withRole(Permissions::ROLE_HEAD);

        $this->actingAs($admin)
            ->get('/notification-settings')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('notification-settings/index')->has('settings')->has('roles'));
    }

    public function test_mark_all_read(): void
    {
        $head = $this->withRole(Permissions::ROLE_DEPARTMENT_HEAD, ['department_id' => $this->dept->id]);
        $supervisor = $this->withRole(Permissions::ROLE_SUPERVISOR, ['department_id' => $this->dept->id]);
        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id]);
        SchoolAssignment::create([
            'school_id' => $teacher->school_id,
            'supervisor_id' => $supervisor->id,
            'department_id' => $this->dept->id,
            'assignment_method' => 'manual',
        ]);
        $this->actingAs($supervisor)->post('/visits', ['visit_type' => 'teacher', 'visitable_id' => $teacher->id, 'visit_date' => '2026-10-01']);

        $this->assertSame(1, $head->fresh()->unreadNotifications()->count());

        $this->actingAs($head)->post('/notifications/read-all')->assertRedirect();
        $this->assertSame(0, $head->fresh()->unreadNotifications()->count());
    }
}
