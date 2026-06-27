<?php

namespace Tests\Feature\Classification;

use App\Models\ClassificationRecord;
use App\Models\Department;
use App\Models\Role;
use App\Models\School;
use App\Models\Teacher;
use App\Models\TeacherClassification;
use App\Models\User;
use App\Models\Visit;
use App\Services\ClassificationService;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClassificationTest extends TestCase
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

    private function service(): ClassificationService
    {
        return app(ClassificationService::class);
    }

    private function makeTeacher(?int $classificationId = null): Teacher
    {
        $dept = Department::where('name', 'التربية الإسلامية')->first();
        $school = School::create(['name' => 'مدرسة الأمل', 'is_active' => true]);

        return Teacher::create([
            'school_id' => $school->id,
            'department_id' => $dept->id,
            'name' => 'محمد أحمد',
            'national_id' => '111',
            'classification_id' => $classificationId,
            'is_active' => true,
        ]);
    }

    /* ===================== المطابقة الآلية ===================== */

    public function test_categorize_matches_score_band(): void
    {
        $svc = $this->service();

        $this->assertSame('needs_support', $svc->categorize(50, false)->code);
        $this->assertSame('average', $svc->categorize(80, false)->code);
        $this->assertSame('distinguished', $svc->categorize(95, false)->code);
    }

    public function test_new_teacher_gets_default_category_regardless_of_score(): void
    {
        $svc = $this->service();

        $this->assertSame('needs_support', $svc->categorize(95, true)->code);   // جديد ⇒ الدعم المكثف
        $this->assertSame('needs_support', $svc->categorize(null, false)->code); // لا درجة ⇒ الافتراضي
        $this->assertTrue($svc->defaultForNew()->is_default_for_new);
    }

    public function test_observation_score_uses_latest_visit_rating(): void
    {
        $teacher = $this->makeTeacher();
        $this->makeVisit($teacher, 70, finalizedForm: false);
        $this->makeVisit($teacher, 88, finalizedForm: false);

        $this->assertSame(88.0, $this->service()->observationScore($teacher));
    }

    /* ===================== التصنيف والاعتماد ===================== */

    public function test_classify_with_auto_approve_applies_effective_classification(): void
    {
        $teacher = $this->makeTeacher();

        $record = $this->service()->classify($teacher, [
            'stage' => 'initial', 'basis' => 'annual_eval', 'score' => 95, 'is_new' => false, 'note' => null,
        ], $this->admin, autoApprove: true);

        $this->assertTrue($record->isApproved());
        $this->assertSame('distinguished', $record->classification->code);
        $this->assertSame($record->teacher_classification_id, $teacher->fresh()->classification_id);
    }

    public function test_supervisor_classify_stays_draft_until_head_approves(): void
    {
        $dept = Department::where('name', 'التربية الإسلامية')->first();
        $supervisor = User::factory()->create(['department_id' => $dept->id]);
        $supervisor->roles()->sync([Role::where('name', Permissions::ROLE_SUPERVISOR)->first()->id]);
        $teacher = $this->makeTeacher();

        // الموجه يصنّف (بلا صلاحية اعتماد) ⇒ مسودّة، لا يتغيّر التصنيف الفعّال
        $this->actingAs($supervisor)->post('/classification/classify', [
            'teacher_id' => $teacher->id, 'stage' => 'initial', 'basis' => 'annual_eval', 'score' => 50,
        ])->assertRedirect();

        $record = ClassificationRecord::first();
        $this->assertSame(ClassificationRecord::STATUS_DRAFT, $record->status);
        $this->assertNull($teacher->fresh()->classification_id);

        // رئيس التوجيه يعتمد ⇒ يُطبَّق
        $this->actingAs($this->admin)->post("/classification/records/{$record->id}/approve")->assertRedirect();
        $this->assertTrue($record->fresh()->isApproved());
        $this->assertSame($record->teacher_classification_id, $teacher->fresh()->classification_id);
    }

    public function test_reclassifying_same_stage_updates_single_record(): void
    {
        $teacher = $this->makeTeacher();
        $svc = $this->service();

        $svc->classify($teacher, ['stage' => 'initial', 'basis' => 'annual_eval', 'score' => 50, 'is_new' => false, 'note' => null], $this->admin, true);
        $svc->classify($teacher, ['stage' => 'initial', 'basis' => 'annual_eval', 'score' => 95, 'is_new' => false, 'note' => null], $this->admin, true);

        $this->assertSame(1, ClassificationRecord::where('teacher_id', $teacher->id)->where('stage', 'initial')->count());
        $this->assertSame('distinguished', $teacher->fresh()->classification->code);
    }

    /* ===================== لوحة الالتزام ===================== */

    public function test_compliance_reflects_required_versus_done(): void
    {
        $average = TeacherClassification::where('code', 'average')->first(); // 2 زيارات + استمارة واحدة
        $teacher = $this->makeTeacher($average->id);

        $board = $this->service()->dashboard($this->admin);
        $row = collect($board['rows'])->firstWhere('teacher_id', $teacher->id);
        $this->assertSame('remaining', $row['status']);
        $this->assertSame(2, $row['required_visits']);
        $this->assertSame(0, $row['done_visits']);

        // زيارتان إحداهما باستمارة معتمدة ⇒ مكتمل (2/2 زيارة، 1/1 استمارة)
        $this->makeVisit($teacher, 80, finalizedForm: true);
        $this->makeVisit($teacher, 82, finalizedForm: false);

        $board = $this->service()->dashboard($this->admin);
        $row = collect($board['rows'])->firstWhere('teacher_id', $teacher->id);
        $this->assertSame(2, $row['done_visits']);
        $this->assertSame(1, $row['done_forms']);
        $this->assertSame('complete', $row['status']);
    }

    public function test_classification_page_renders(): void
    {
        $this->makeTeacher();

        $this->actingAs($this->admin)->get('/classification')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('classification/index')->has('dashboard')->has('rules'));
    }

    private function makeVisit(Teacher $teacher, int $rating, bool $finalizedForm): Visit
    {
        $visit = Visit::create([
            'supervisor_id' => $this->admin->id,
            'school_id' => $teacher->school_id,
            'department_id' => $teacher->department_id,
            'visit_type' => 'teacher',
            'visitable_type' => Teacher::class,
            'visitable_id' => $teacher->id,
            'visit_date' => now()->toDateString(),
            'overall_rating' => $rating,
            'status' => 'done',
            'created_by' => $this->admin->id,
        ]);

        if ($finalizedForm) {
            $visit->form()->create(['save_status' => 'final', 'finalized_at' => now()]);
        }

        return $visit;
    }
}
