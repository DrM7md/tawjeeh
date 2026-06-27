<?php

namespace App\Services;

use App\Models\CoordinatorAssignment;
use App\Models\Department;
use App\Models\PortfolioReview;
use App\Models\PortfolioReviewScore;
use App\Models\PortfolioReviewTemplate;
use App\Models\SchoolAssignment;
use App\Models\Semester;
use App\Models\User;
use App\Support\ActiveContext;
use App\Support\Permissions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

/**
 * تقييم ملفات المنسق: إنشاء السجل بنسخ بنود القالب لقطةً، حفظ الدرجات،
 * حساب المجموع والتقدير آليًا، وإدارة مرفقات البنود.
 */
class PortfolioReviewService
{
    public function list(User $user, ?int $supervisorId = null): Collection
    {
        return PortfolioReview::query()
            ->visibleTo($user)
            // عند الدخول على موجّه بعينه تُقصَر التقييمات على منسّقي مدارسه المكلّف بها.
            ->when($supervisorId, fn ($q) => $q->whereHas(
                'coordinator',
                fn ($c) => $c->whereIn('school_id', SchoolAssignment::where('supervisor_id', $supervisorId)->pluck('school_id')),
            ))
            ->with([
                'coordinator:id,name,school_id,department_id',
                'coordinator.school:id,name',
                'department:id,name',
                'supervisor:id,name',
                'template:id,name',
            ])
            ->withCount('scores')
            ->latest('reviewed_at')
            ->latest('id')
            ->get();
    }

    /**
     * بطاقات الأقسام: لكل قسم نسبة المنسّقين المُقيَّمين (المستوى الأعلى — رئيس التوجيه).
     *
     * @return list<array<string,mixed>>
     */
    public function departmentBoards(): array
    {
        $departments = Department::where('is_active', true)->orderBy('name')->get(['id', 'name']);
        $coordinators = CoordinatorAssignment::active()->get(['teacher_id', 'school_id', 'department_id'])->groupBy('department_id');
        $done = $this->finalizedTeacherIds();

        return $departments->map(fn ($d) => array_merge(
            ['id' => $d->id, 'name' => $d->name],
            $this->statsForCoordinators($coordinators->get($d->id, collect()), $done),
        ))->all();
    }

    /**
     * بطاقات الموجهين في قسم: لكل موجّه نسبة تقييم منسّقي مدارسه المكلّف بها.
     *
     * @return list<array<string,mixed>>
     */
    public function supervisorBoards(int $departmentId): array
    {
        $supervisors = User::where('department_id', $departmentId)
            ->where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR))
            ->orderBy('name')->get(['id', 'name', 'gender']);

        if ($supervisors->isEmpty()) {
            return [];
        }

        $assignments = SchoolAssignment::whereIn('supervisor_id', $supervisors->pluck('id'))
            ->get(['supervisor_id', 'school_id'])->groupBy('supervisor_id');

        $schoolIds = $assignments->flatten(1)->pluck('school_id')->unique();
        $coordinators = CoordinatorAssignment::active()
            ->whereIn('school_id', $schoolIds)
            ->where('department_id', $departmentId)
            ->get(['teacher_id', 'school_id'])->groupBy('school_id');

        $done = $this->finalizedTeacherIds();

        return $supervisors->map(function ($s) use ($assignments, $coordinators, $done) {
            $sids = ($assignments->get($s->id) ?? collect())->pluck('school_id');
            $cs = $sids->flatMap(fn ($id) => $coordinators->get($id, collect()));

            return array_merge(
                ['id' => $s->id, 'name' => $s->name, 'gender' => $s->gender, 'schools' => $sids->count()],
                $this->statsForCoordinators($cs, $done),
            );
        })->all();
    }

    /** معرّفات المنسّقين الذين لهم تقييم معتمَد في العام المختار (مفهرسة للبحث السريع). @return array<int,bool> */
    private function finalizedTeacherIds(): array
    {
        return PortfolioReview::where('status', 'final')->pluck('teacher_id')->mapWithKeys(fn ($id) => [$id => true])->all();
    }

    /** إحصاء تقييم مجموعة منسّقين لبطاقة قسم/موجّه. @param array<int,bool> $done @return array<string,int|float> */
    private function statsForCoordinators(Collection $coordinators, array $done): array
    {
        $ids = $coordinators->pluck('teacher_id')->unique();
        $total = $ids->count();
        $evaluated = $ids->filter(fn ($id) => isset($done[$id]))->count();

        return [
            'total' => $total,
            'done' => $evaluated,
            'remaining' => $total - $evaluated,
            'late' => 0,
            'completion' => $total ? round($evaluated / $total * 100, 1) : 0,
        ];
    }

    /** القالب النشط الثابت (الأول إن تعدّد). */
    public function activeTemplate(): ?PortfolioReviewTemplate
    {
        return PortfolioReviewTemplate::where('is_active', true)->orderBy('id')->first();
    }

    /**
     * ينشئ سجلًا للمنسق في الفصل المحدّد وينسخ بنود القالب الثابت لقطةً.
     * إن وُجد تقييم سابق لنفس المنسق والفصل أعاده دون إنشاء جديد.
     */
    public function create(array $data): PortfolioReview
    {
        $existing = PortfolioReview::where('teacher_id', $data['teacher_id'])
            ->where('term', $data['term'])->first();
        if ($existing) {
            return $existing;
        }

        $template = PortfolioReviewTemplate::with('items')->findOrFail($data['portfolio_review_template_id']);

        $review = PortfolioReview::create([
            'teacher_id' => $data['teacher_id'],
            'supervisor_id' => auth()->id(),
            'department_id' => $data['department_id'],
            'portfolio_review_template_id' => $template->id,
            'term' => $data['term'],
            'semester_id' => $this->semesterForTerm($data['term']),
            'status' => 'draft',
            'reviewed_at' => $data['reviewed_at'] ?? now()->toDateString(),
        ]);

        foreach ($template->items as $item) {
            $review->scores()->create([
                'portfolio_review_item_id' => $item->id,
                'criterion_text' => $item->criterion_text,
                'max_score' => $item->max_score,
                'sort_order' => $item->sort_order,
            ]);
        }

        return $review;
    }

    /**
     * يشتقّ الفصل الدراسي من فصل التقييم (للتقارير فقط). يرجع للفصل المختار إن تعذّر.
     */
    private function semesterForTerm(string $term): ?int
    {
        $context = app(ActiveContext::class);

        $semesters = Semester::withoutGlobalScopes()
            ->where('academic_year_id', $context->selectedYearId())
            ->orderBy('start_date')->orderBy('id')->pluck('id');

        $derived = $term === 'first' ? ($semesters[0] ?? null) : ($semesters[1] ?? $semesters[0] ?? null);

        return $derived ?? $context->selectedSemesterId();
    }

    /**
     * يحفظ درجات/ملاحظات البنود ويحسب المجموع والتقدير، ويضبط حالة السجل.
     *
     * @param  array<int, array{score?: int|null, note?: string|null}>  $scores  مفهرسة بمعرّف الدرجة
     */
    public function saveForm(PortfolioReview $review, array $scores, ?string $notes, string $status): void
    {
        $rows = $review->scores()->get();

        foreach ($rows as $row) {
            $input = $scores[$row->id] ?? null;
            if ($input === null) {
                continue;
            }
            $score = $input['score'] ?? null;
            // نضبط الدرجة ضمن حدّ البند
            if ($score !== null) {
                $score = max(0, min((int) $score, $row->max_score));
            }
            $row->update([
                'score' => $score,
                'note' => $input['note'] ?? null,
            ]);
        }

        $review->load('scores');
        $total = (float) $review->scores->sum('score');
        $maxTotal = (int) $review->scores->sum('max_score');

        $review->update([
            'total_score' => $total,
            'result' => $this->grade($total, $maxTotal),
            'notes' => $notes,
            'status' => $status,
        ]);
    }

    /** التقدير اللفظي من نسبة الدرجة الكلية. */
    public function grade(float $total, int $maxTotal): ?string
    {
        if ($maxTotal <= 0) {
            return null;
        }
        $pct = ($total / $maxTotal) * 100;

        return match (true) {
            $pct >= 90 => 'ممتاز',
            $pct >= 80 => 'جيد جدًا',
            $pct >= 70 => 'جيد',
            $pct >= 60 => 'مقبول',
            default => 'ضعيف',
        };
    }

    public function addAttachment(PortfolioReviewScore $score, UploadedFile $file): void
    {
        // استبدال المرفق السابق إن وُجد
        if ($score->attachment_path) {
            Storage::disk('local')->delete($score->attachment_path);
        }

        $path = $file->store('portfolio-files', 'local'); // تخزين خاص (غير عام)

        $score->update([
            'attachment_path' => $path,
            'attachment_name' => $file->getClientOriginalName(),
        ]);
    }

    public function deleteAttachment(PortfolioReviewScore $score): void
    {
        if ($score->attachment_path) {
            Storage::disk('local')->delete($score->attachment_path);
        }
        $score->update(['attachment_path' => null, 'attachment_name' => null]);
    }

    public function delete(PortfolioReview $review): void
    {
        // حذف مرفقات البنود من القرص قبل حذف السجل (cascade يحذف الصفوف)
        foreach ($review->scores()->whereNotNull('attachment_path')->pluck('attachment_path') as $path) {
            Storage::disk('local')->delete($path);
        }
        $review->delete();
    }
}
