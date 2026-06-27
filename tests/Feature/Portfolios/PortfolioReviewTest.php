<?php

namespace Tests\Feature\Portfolios;

use App\Models\CoordinatorAssignment;
use App\Models\Department;
use App\Models\PortfolioReview;
use App\Models\PortfolioReviewTemplate;
use App\Models\Role;
use App\Models\Teacher;
use App\Models\User;
use App\Services\PortfolioReviewService;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PortfolioReviewTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Department $dept;
    private PortfolioReviewTemplate $template;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ReferenceDataSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->roles()->sync([Role::where('name', Permissions::ROLE_HEAD)->first()->id]);
        $this->dept = Department::first();

        $this->template = PortfolioReviewTemplate::create(['name' => 'قالب اختبار', 'is_active' => true]);
        $this->template->items()->createMany([
            ['criterion_text' => 'تنظيم الملف', 'max_score' => 10, 'sort_order' => 1],
            ['criterion_text' => 'خطة العمل', 'max_score' => 5, 'sort_order' => 2],
        ]);
    }

    /** ينشئ معلمًا له تكليف تنسيق نشط (= منسق) ويرجع المعلم. */
    private function makeCoordinator(): Teacher
    {
        $teacher = Teacher::factory()->create(['department_id' => $this->dept->id]);
        CoordinatorAssignment::create([
            'teacher_id' => $teacher->id,
            'school_id' => $teacher->school_id,
            'department_id' => $this->dept->id,
            'start_date' => now()->subMonths(3)->toDateString(),
            'status' => CoordinatorAssignment::STATUS_ACTIVE,
        ]);

        return $teacher;
    }

    public function test_create_snapshots_template_items_into_scores(): void
    {
        $this->actingAs($this->admin);
        $coordinator = $this->makeCoordinator();

        $review = app(PortfolioReviewService::class)->create([
            'teacher_id' => $coordinator->id,
            'portfolio_review_template_id' => $this->template->id,
            'term' => 'first',
            'department_id' => $this->dept->id,
        ]);

        $this->assertNotNull($review->academic_year_id);
        $this->assertNotNull($review->semester_id);
        $this->assertSame('draft', $review->status);
        $this->assertCount(2, $review->scores);
        $this->assertSame('تنظيم الملف', $review->scores->first()->criterion_text);
        $this->assertSame(10, $review->scores->first()->max_score);
    }

    public function test_save_form_computes_total_grade_and_finalizes(): void
    {
        $this->actingAs($this->admin);
        $coordinator = $this->makeCoordinator();
        $review = app(PortfolioReviewService::class)->create([
            'teacher_id' => $coordinator->id,
            'portfolio_review_template_id' => $this->template->id,
            'term' => 'first',
            'department_id' => $this->dept->id,
        ]);

        $payload = [];
        foreach ($review->scores as $i => $score) {
            $payload[$score->id] = ['score' => $i === 0 ? 10 : 4, 'note' => 'جيد'];
        }

        $this->post("/portfolios/{$review->id}/form", [
            'scores' => $payload,
            'notes' => 'ملاحظة عامة',
            'status' => 'final',
        ])->assertRedirect(route('portfolios.index'));

        $review->refresh();
        $this->assertSame('final', $review->status);
        $this->assertEquals(14, (float) $review->total_score);   // 10 + 4 من أصل 15
        $this->assertSame('ممتاز', $review->result);             // 14/15 ≈ 93%
    }

    public function test_score_is_clamped_to_item_max(): void
    {
        $this->actingAs($this->admin);
        $coordinator = $this->makeCoordinator();
        $review = app(PortfolioReviewService::class)->create([
            'teacher_id' => $coordinator->id,
            'portfolio_review_template_id' => $this->template->id,
            'term' => 'first',
            'department_id' => $this->dept->id,
        ]);
        $first = $review->scores->first(); // max 10

        app(PortfolioReviewService::class)->saveForm($review, [$first->id => ['score' => 50]], null, 'draft');

        $this->assertSame(10, $first->refresh()->score);
    }

    public function test_supervisor_sees_only_own_reviews(): void
    {
        $sup = User::factory()->create(['department_id' => $this->dept->id]);
        $sup->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);
        $service = app(PortfolioReviewService::class);
        $base = [
            'portfolio_review_template_id' => $this->template->id,
            'term' => 'first',
            'department_id' => $this->dept->id,
        ];

        $this->actingAs($sup);
        $service->create([...$base, 'teacher_id' => $this->makeCoordinator()->id]);
        $this->actingAs($this->admin);
        $service->create([...$base, 'teacher_id' => $this->makeCoordinator()->id]);

        $this->assertCount(1, $service->list($sup));
        $this->assertCount(2, $service->list($this->admin));
    }

    public function test_portfolios_page_renders(): void
    {
        $this->actingAs($this->admin)
            ->get('/portfolios')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('portfolios/index')->has('reviews')->has('coordinators')->has('hasTemplate'));
    }

    public function test_user_without_create_cannot_store(): void
    {
        $role = Role::create(['name' => 'viewer_only', 'display_name' => 'مشاهد', 'level' => 3, 'permissions' => ['portfolios.view.own'], 'is_system' => false]);
        $user = User::factory()->create();
        $user->roles()->sync([$role->id]);
        $coordinator = $this->makeCoordinator();

        $this->actingAs($user)
            ->post('/portfolios', [
                'teacher_id' => $coordinator->id,
                'portfolio_review_template_id' => $this->template->id,
            'term' => 'first',
                'department_id' => $this->dept->id,
            ])
            ->assertForbidden();
    }

    public function test_template_with_reviews_cannot_be_deleted(): void
    {
        $this->actingAs($this->admin);
        app(PortfolioReviewService::class)->create([
            'teacher_id' => $this->makeCoordinator()->id,
            'portfolio_review_template_id' => $this->template->id,
            'term' => 'first',
            'department_id' => $this->dept->id,
        ]);

        $this->delete("/portfolio-templates/{$this->template->id}")->assertStatus(422);
        $this->assertDatabaseHas('portfolio_review_templates', ['id' => $this->template->id]);
    }
}
