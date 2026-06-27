<?php

namespace App\Services;

use App\Models\Department;
use App\Models\ReviewDomain;
use App\Models\ReviewIndicator;
use App\Models\SchoolAssignment;
use App\Models\Semester;
use App\Models\TestReview;
use App\Models\TestReviewFile;
use App\Models\TestReviewForm;
use App\Models\User;
use App\Support\ActiveContext;
use App\Support\Permissions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

/**
 * تحكيم الاختبارات. القواعد: TR في Brain/05-BUSINESS-RULES.md.
 */
class TestReviewService
{
    /** الاختبارات الأربعة (منتصف/نهاية لكل فصل) — أساس حساب نسبة التغطية. */
    public const EXAM_PERIODS = ['mid_first', 'final_first', 'mid_second', 'final_second'];

    public const EXAM_COUNT = 4;

    public function list(User $user, ?int $supervisorId = null): Collection
    {
        return TestReview::query()
            ->visibleTo($user)
            // رئيس القسم يدخل على موجّه بعينه → تُقصَر القائمة على تحكيمات ذلك الموجّه
            ->when($supervisorId, fn ($q) => $q->where('supervisor_id', $supervisorId))
            ->with(['school:id,name,gender', 'department:id,name', 'stage:id,name', 'grade:id,name', 'track:id,name', 'preparer:id,name', 'supervisor:id,name', 'form:id,test_review_id,total_score'])
            ->latest('reviewed_at')
            ->latest('id')
            ->get();
    }

    /**
     * بطاقات الأقسام: نسبة تغطية التحكيم لكل قسم (للمستوى الأعلى — رئيس التوجيه).
     *
     * @return list<array<string,mixed>>
     */
    public function departmentBoards(): array
    {
        $departments = Department::where('is_active', true)->orderBy('name')->get(['id', 'name']);

        $schoolCounts = SchoolAssignment::query()
            ->get(['department_id', 'school_id'])
            ->groupBy('department_id')
            ->map(fn ($g) => $g->pluck('school_id')->unique()->count());

        $supervisorCounts = User::whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR))
            ->where('is_active', true)
            ->get(['id', 'department_id'])
            ->groupBy('department_id')
            ->map->count();

        $reviews = TestReview::query()
            ->get(['department_id', 'school_id', 'exam_period', 'status'])
            ->groupBy('department_id');

        return $departments->map(fn (Department $d) => array_merge(
            ['id' => $d->id, 'name' => $d->name, 'supervisors' => (int) ($supervisorCounts[$d->id] ?? 0)],
            $this->coverageStats((int) ($schoolCounts[$d->id] ?? 0), $reviews->get($d->id, collect())),
        ))->all();
    }

    /**
     * بطاقات الموجهين في قسم: نسبة تغطية التحكيم لكل موجّه (مدارسه المكلّف بها × الاختبارات الأربعة).
     *
     * @return list<array<string,mixed>>
     */
    public function supervisorBoards(int $departmentId): array
    {
        $supervisors = User::where('department_id', $departmentId)
            ->where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR))
            ->orderBy('name')->get(['id', 'name']);

        if ($supervisors->isEmpty()) {
            return [];
        }

        $ids = $supervisors->pluck('id');

        $schoolCounts = SchoolAssignment::whereIn('supervisor_id', $ids)
            ->get(['supervisor_id', 'school_id'])
            ->groupBy('supervisor_id')
            ->map(fn ($g) => $g->pluck('school_id')->unique()->count());

        $reviews = TestReview::whereIn('supervisor_id', $ids)
            ->get(['supervisor_id', 'school_id', 'exam_period', 'status'])
            ->groupBy('supervisor_id');

        return $supervisors->map(fn (User $s) => array_merge(
            ['id' => $s->id, 'name' => $s->name],
            $this->coverageStats((int) ($schoolCounts[$s->id] ?? 0), $reviews->get($s->id, collect())),
        ))->all();
    }

    /**
     * إحصائيات التغطية: المطلوب = المدارس × 4 اختبارات؛ المُنجَز = خانات (مدرسة+اختبار) معتمدة.
     *
     * @param  Collection<int,TestReview>  $reviews
     * @return array<string,int|float>
     */
    private function coverageStats(int $schoolCount, Collection $reviews): array
    {
        $expected = $schoolCount * self::EXAM_COUNT;
        $perExamDone = $this->approvedSlotsByExam($reviews);
        $done = array_sum($perExamDone);

        // مؤشّر لكل اختبار: المدارس المعتمدة في ذلك الاختبار ÷ إجمالي المدارس
        $perExam = array_map(fn ($exam) => [
            'exam' => $exam,
            'done' => $perExamDone[$exam] ?? 0,
            'expected' => $schoolCount,
            'completion' => $schoolCount ? round(($perExamDone[$exam] ?? 0) / $schoolCount * 100, 1) : 0,
        ], self::EXAM_PERIODS);

        return [
            'schools' => $schoolCount,
            'expected' => $expected,
            'done' => $done,
            'remaining' => max(0, $expected - $done),
            'total' => $reviews->count(),
            'final' => $reviews->where('status', 'final')->count(),
            'completion' => $expected ? round($done / $expected * 100, 1) : 0,
            'per_exam' => $perExam,
        ];
    }

    /**
     * عدد المدارس المعتمدة لكل اختبار: خانة (مدرسة + اختبار) معتمدة = لها تحكيم معتمد دون مسودة معلّقة.
     *
     * @return array<string,int> مفهرسة بقيمة الاختبار
     */
    private function approvedSlotsByExam(Collection $reviews): array
    {
        $slots = [];
        foreach ($reviews as $r) {
            if (! $r->school_id || ! $r->exam_period) {
                continue;
            }
            $key = $r->exam_period.'|'.$r->school_id;
            $slots[$key] ??= ['exam' => $r->exam_period, 'final' => 0, 'draft' => 0];
            $slots[$key][$r->status === 'final' ? 'final' : 'draft']++;
        }

        $counts = [];
        foreach ($slots as $s) {
            if ($s['final'] > 0 && $s['draft'] === 0) {
                $counts[$s['exam']] = ($counts[$s['exam']] ?? 0) + 1;
            }
        }

        return $counts;
    }

    public function create(array $data): TestReview
    {
        return TestReview::create([
            'supervisor_id' => auth()->id(),
            'school_id' => $data['school_id'],
            'department_id' => $data['department_id'],
            'stage_id' => $data['stage_id'] ?? null,
            'grade_id' => $data['grade_id'] ?? null,
            'grade_track_id' => $data['grade_track_id'] ?? null,
            'preparer_id' => $data['preparer_id'] ?? null,
            'exam_period' => $data['exam_period'] ?? null,
            'semester_id' => $this->semesterForExam($data['exam_period'] ?? null),
            'status' => 'draft',
            'reviewed_at' => $data['reviewed_at'] ?? now()->toDateString(),
        ]);
    }

    /**
     * يشتقّ الفصل الدراسي من الاختبار: منتصف/نهاية الأول → الفصل الأول، والثاني → الفصل الثاني.
     * يُخزَّن للتقارير فقط؛ التحكيم لا يُصفَّى بالفصل. يرجع للفصل المختار إن تعذّر التحديد.
     */
    private function semesterForExam(?string $examPeriod): ?int
    {
        $context = app(ActiveContext::class);

        // بدون اختبار محدّد (استدعاءات داخلية قديمة) نبقى على الفصل المختار
        if ($examPeriod === null) {
            return $context->selectedSemesterId();
        }

        $semesters = Semester::withoutGlobalScopes()
            ->where('academic_year_id', $context->selectedYearId())
            ->orderBy('start_date')->orderBy('id')->pluck('id');

        $isFirst = in_array($examPeriod, ['mid_first', 'final_first'], true);
        $derived = $isFirst ? ($semesters[0] ?? null) : ($semesters[1] ?? $semesters[0] ?? null);

        return $derived ?? $context->selectedSemesterId();
    }

    public function addFile(TestReview $review, UploadedFile $file): void
    {
        $path = $file->store('review-files', 'local'); // تخزين خاص (غير عام)

        $review->files()->create([
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime' => $file->getClientMimeType(),
            'size' => $file->getSize(),
        ]);
    }

    public function deleteFile(TestReviewFile $file): void
    {
        Storage::disk('local')->delete($file->path);
        $file->delete();
    }

    /** هيكل استمارة التحكيم الرسمية: المجالات ← البنود ← المؤشرات. */
    public function formStructure(): Collection
    {
        return ReviewDomain::with('items.indicators')->orderBy('sort_order')->get();
    }

    /**
     * حفظ استمارة التحكيم: لكل بند مؤشّر مختار + ملاحظات.
     * البنية: criteria = [ item_id => ['indicator_id' => ?int, 'notes' => ?string] ].
     * الدرجة الخفية = مجموع أوزان المؤشرات المختارة (للإحصاء).
     */
    public function saveForm(TestReview $review, array $data, string $status): TestReviewForm
    {
        $items = $data['criteria'] ?? [];

        $indicatorIds = collect($items)->pluck('indicator_id')->filter()->all();
        $weights = ReviewIndicator::whereIn('id', $indicatorIds)->pluck('weight', 'id');
        $total = collect($items)->sum(fn ($v) => (int) ($weights[$v['indicator_id'] ?? 0] ?? 0));

        $form = TestReviewForm::updateOrCreate(
            ['test_review_id' => $review->id],
            [
                'criteria' => $items,
                'total_score' => $total,
                'notes' => $data['notes'] ?? null,
                'result' => $data['result'] ?? null,
            ],
        );

        $review->update(['status' => $status]);

        return $form;
    }

    public function delete(TestReview $review): void
    {
        $review->delete();
    }
}
