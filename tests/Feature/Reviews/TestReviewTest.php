<?php

namespace Tests\Feature\Reviews;

use App\Models\AcademicYear;
use App\Models\Department;
use App\Models\ReviewItem;
use App\Models\Role;
use App\Models\School;
use App\Models\Stage;
use App\Models\TestReview;
use App\Models\User;
use App\Services\TestReviewService;
use App\Support\ActiveContext;
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

    public function test_exam_period_is_stored_and_semester_derived(): void
    {
        $this->actingAs($this->admin);
        $year = AcademicYear::where('is_active', true)->first();
        $semesters = $year->semesters()->orderBy('start_date')->orderBy('id')->pluck('id');

        $first = app(TestReviewService::class)->create([
            'school_id' => $this->school->id, 'department_id' => $this->dept->id, 'exam_period' => 'final_first',
        ]);
        $second = app(TestReviewService::class)->create([
            'school_id' => $this->school->id, 'department_id' => $this->dept->id, 'exam_period' => 'mid_second',
        ]);

        $this->assertSame('final_first', $first->exam_period);
        $this->assertSame($semesters[0], $first->semester_id);
        $this->assertSame('mid_second', $second->exam_period);
        $this->assertSame($semesters[1], $second->semester_id);
    }

    public function test_save_form_records_indicators_and_finalizes(): void
    {
        $this->actingAs($this->admin);
        $review = app(TestReviewService::class)->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);

        // اختيار المؤشّر الأول (الأعلى وزنًا) لأول بندين — الدرجة الخفية = مجموع الوزنين
        $items = ReviewItem::with('indicators')->orderBy('id')->take(2)->get();
        $first = $items[0]->indicators->first();
        $second = $items[1]->indicators->first();

        $this->post("/reviews/{$review->id}/form", [
            'criteria' => [
                $items[0]->id => ['indicator_id' => $first->id, 'notes' => 'بحاجة لمراجعة'],
                $items[1]->id => ['indicator_id' => $second->id, 'notes' => ''],
            ],
            'status' => 'final',
        ])->assertRedirect();

        $review->refresh();
        $this->assertSame('final', $review->status);
        $this->assertEquals($first->weight + $second->weight, (float) $review->form->total_score);
        $this->assertSame($first->id, $review->form->criteria[$items[0]->id]['indicator_id']);
    }

    public function test_each_semester_review_is_independent(): void
    {
        $this->actingAs($this->admin);
        $service = app(TestReviewService::class);
        $year = AcademicYear::where('is_active', true)->first();
        $sem1 = $year->semesters()->where('is_active', true)->first();
        $sem2 = $year->semesters()->where('is_active', false)->first();

        // تحكيم في الفصل النشط
        $service->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id, 'grade' => 'السابع']);

        // التبديل للفصل الثاني ثم إنشاء تحكيم آخر
        app(ActiveContext::class)->setSemester($sem2->id);
        app()->forgetInstance(ActiveContext::class);
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

    private function supervisorIn(Department $dept): User
    {
        $u = User::factory()->create(['department_id' => $dept->id]);
        $u->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);

        return $u->fresh();
    }

    public function test_head_sees_departments_board(): void
    {
        $this->actingAs($this->admin)
            ->get('/reviews')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reviews/index')->where('mode', 'departments')->has('departments'));
    }

    public function test_head_can_drill_into_department_supervisors(): void
    {
        $this->supervisorIn($this->dept);

        $this->actingAs($this->admin)
            ->get('/reviews?department='.$this->dept->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reviews/index')
                ->where('mode', 'supervisors')
                ->where('department.id', $this->dept->id)
                ->has('supervisors'));
    }

    public function test_drilling_into_supervisor_shows_their_reviews(): void
    {
        $sup = $this->supervisorIn($this->dept);

        $this->actingAs($this->admin)
            ->get('/reviews?supervisor='.$sup->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reviews/index')
                ->where('mode', 'reviews')
                ->where('selectedSupervisor.id', $sup->id)
                ->has('reviews'));
    }

    public function test_supervisor_sees_own_reviews_page(): void
    {
        $sup = $this->supervisorIn($this->dept);

        $this->actingAs($sup)
            ->get('/reviews')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reviews/index')
                ->where('mode', 'reviews')
                ->where('selectedSupervisor', null)
                ->has('reviews'));
    }

    public function test_department_head_cannot_view_other_department_supervisor(): void
    {
        $otherDept = Department::create(['name' => 'قسم آخر', 'is_active' => true]);
        $foreign = $this->supervisorIn($otherDept);

        $head = User::factory()->create(['department_id' => $this->dept->id]);
        $head->roles()->sync([Role::where('name', Permissions::ROLE_DEPARTMENT_HEAD)->first()->id]);

        $this->actingAs($head->fresh())
            ->get('/reviews?supervisor='.$foreign->id)
            ->assertForbidden();
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

    public function test_review_show_returns_form_structure(): void
    {
        $this->actingAs($this->admin);
        $review = app(TestReviewService::class)->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);

        $this->get("/reviews/{$review->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reviews/show')->has('domains')->has('review'));
    }

    public function test_review_print_renders(): void
    {
        $this->actingAs($this->admin);
        $review = app(TestReviewService::class)->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);

        $this->get("/reviews/{$review->id}/print")
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reviews/form-print')->has('domains'));
    }

    public function test_admin_can_edit_review_form_structure(): void
    {
        $this->actingAs($this->admin);

        // إضافة مجال ← بند ← مؤشّر عبر المحرّر
        $this->post('/review-domains', ['name' => 'مجال جديد', 'kind' => 'rating'])->assertRedirect();
        $domain = \App\Models\ReviewDomain::where('name', 'مجال جديد')->firstOrFail();

        $this->post("/review-domains/{$domain->id}/items", ['name' => 'بند جديد', 'description' => 'وصف'])->assertRedirect();
        $item = $domain->items()->firstOrFail();

        $this->post("/review-items/{$item->id}/indicators", ['label' => 'ممتاز', 'weight' => 3])->assertRedirect();

        $this->assertDatabaseHas('review_indicators', ['review_item_id' => $item->id, 'label' => 'ممتاز', 'weight' => 3]);
    }
}
