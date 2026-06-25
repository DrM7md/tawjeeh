<?php

namespace Tests\Feature\Reviews;

use App\Models\Department;
use App\Models\Role;
use App\Models\School;
use App\Models\Stage;
use App\Models\TestReview;
use App\Models\User;
use App\Services\TestReviewService;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TestReviewTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Department $dept;
    private School $school;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ReferenceDataSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->roles()->sync([Role::where('name', Permissions::ROLE_HEAD)->first()->id]);
        $this->dept = Department::first();
        $this->school = School::factory()->create();
    }

    public function test_create_review_attaches_context(): void
    {
        $this->actingAs($this->admin);
        $review = app(TestReviewService::class)->create([
            'school_id' => $this->school->id,
            'department_id' => $this->dept->id,
            'stage_id' => Stage::first()->id,
            'grade' => 'السابع',
        ]);

        $this->assertNotNull($review->academic_year_id);
        $this->assertNotNull($review->semester_id);
        $this->assertSame('draft', $review->status);
    }

    public function test_save_form_computes_total_and_finalizes(): void
    {
        $this->actingAs($this->admin);
        $review = app(TestReviewService::class)->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);

        $this->post("/reviews/{$review->id}/form", [
            'criteria' => ['الشمولية' => 5, 'وضوح الصياغة' => 4],
            'result' => 'ممتاز',
            'status' => 'final',
        ])->assertRedirect();

        $review->refresh();
        $this->assertSame('final', $review->status);
        $this->assertEquals(9, (float) $review->form->total_score);
    }

    public function test_each_semester_review_is_independent(): void
    {
        $this->actingAs($this->admin);
        $service = app(TestReviewService::class);
        $year = \App\Models\AcademicYear::where('is_active', true)->first();
        $sem1 = $year->semesters()->where('is_active', true)->first();
        $sem2 = $year->semesters()->where('is_active', false)->first();

        // تحكيم في الفصل النشط
        $service->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id, 'grade' => 'السابع']);

        // التبديل للفصل الثاني ثم إنشاء تحكيم آخر
        app(\App\Support\ActiveContext::class)->setSemester($sem2->id);
        app()->forgetInstance(\App\Support\ActiveContext::class);
        $service->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id, 'grade' => 'السابع']);

        $this->assertSame(1, TestReview::withoutAcademicContext()->where('semester_id', $sem1->id)->count());
        $this->assertSame(1, TestReview::withoutAcademicContext()->where('semester_id', $sem2->id)->count());
    }

    public function test_supervisor_sees_only_own_reviews(): void
    {
        $sup = User::factory()->create(['department_id' => $this->dept->id]);
        $sup->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);

        $this->actingAs($sup);
        app(TestReviewService::class)->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);
        $this->actingAs($this->admin);
        app(TestReviewService::class)->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);

        $this->assertCount(1, app(TestReviewService::class)->list($sup));
        $this->assertCount(2, app(TestReviewService::class)->list($this->admin));
    }

    public function test_reviews_page_renders(): void
    {
        $this->actingAs($this->admin)
            ->get('/reviews')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reviews/index')->has('reviews'));
    }

    public function test_user_without_create_cannot_store(): void
    {
        $role = Role::create(['name' => 'viewer_only', 'display_name' => 'مشاهد', 'level' => 3, 'permissions' => ['reviews.view.own'], 'is_system' => false]);
        $user = User::factory()->create();
        $user->roles()->sync([$role->id]);

        $this->actingAs($user)
            ->post('/reviews', ['school_id' => $this->school->id, 'department_id' => $this->dept->id])
            ->assertForbidden();
    }
}
