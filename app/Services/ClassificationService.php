<?php

namespace App\Services;

use App\Models\ClassificationRecord;
use App\Models\Department;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\TeacherClassification;
use App\Models\User;
use App\Models\Visit;
use App\Support\ActiveContext;
use App\Support\Permissions;
use Illuminate\Support\Collection;

/**
 * محرك التصنيف (القسم 1.1): يطابق درجة المعلم بقواعد التصنيف لاختيار الفئة آليًا،
 * يسجّل التصنيف المرحلي ويعتمده، ويحسب لوحة الالتزام (الزيارات/الاستمارات المطلوبة مقابل المنفّذ).
 */
class ClassificationService
{
    public function __construct(
        private readonly ActiveContext $context,
        private readonly VisitService $visits,
    ) {}

    /** قواعد التصنيف مرتّبة (للعرض والمطابقة). @return Collection<int,TeacherClassification> */
    public function rules(): Collection
    {
        return TeacherClassification::orderBy('sort_order')->orderByDesc('required_visits')->get();
    }

    /** فئة المعلم الجديد آليًا (الدعم المكثف) — وإلا الأعلى متطلبات. */
    public function defaultForNew(): ?TeacherClassification
    {
        return $this->rules()->firstWhere('is_default_for_new', true)
            ?? $this->rules()->sortByDesc('required_visits')->first();
    }

    /** اختيار الفئة من الدرجة المئوية: الجديد ⇒ الافتراضي، وإلا مطابقة الحدود. */
    public function categorize(?float $score, bool $isNew): ?TeacherClassification
    {
        if ($isNew || $score === null) {
            return $this->defaultForNew();
        }

        return $this->rules()->first(fn (TeacherClassification $r) => $r->matchesScore($score))
            ?? $this->defaultForNew();
    }

    /** درجة مقترحة من ملاحظة الموجه = آخر تقدير زيارة للمعلم (نسبة مئوية) أو null. */
    public function observationScore(Teacher $teacher): ?float
    {
        $rating = Visit::withoutAcademicContext()
            ->where('visitable_type', Teacher::class)
            ->where('visitable_id', $teacher->id)
            ->whereNotNull('overall_rating')
            ->orderByDesc('visit_date')->orderByDesc('id')
            ->value('overall_rating');

        return $rating !== null ? (float) $rating : null;
    }

    /** هل يُعدّ المعلم «جديدًا» (لا زيارات سابقة عبر الأعوام)؟ اقتراح فقط — قابل للتجاوز يدويًا. */
    public function looksNew(Teacher $teacher): bool
    {
        $ids = $teacher->national_id
            ? Teacher::withoutAcademicContext()->where('national_id', $teacher->national_id)->pluck('id')
            : collect([$teacher->id]);

        return ! Visit::withoutAcademicContext()
            ->where('visitable_type', Teacher::class)
            ->whereIn('visitable_id', $ids)
            ->exists();
    }

    /**
     * تصنيف معلم في مرحلة محدّدة: يحدّد الفئة، يحفظ السجلّ (سجلّ واحد لكل مرحلة/عام)،
     * ويعتمده فورًا إن كان المنفّذ يملك صلاحية الاعتماد.
     *
     * @param  array{stage:string,basis:string,score:?float,is_new:bool,note:?string}  $data
     */
    public function classify(Teacher $teacher, array $data, User $actor, bool $autoApprove): ClassificationRecord
    {
        $score = $data['basis'] === ClassificationRecord::BASIS_OBSERVATION && $data['score'] === null
            ? $this->observationScore($teacher)
            : $data['score'];

        $category = $this->categorize($score === null ? null : (float) $score, $data['is_new']);

        $record = ClassificationRecord::updateOrCreate(
            [
                'teacher_id' => $teacher->id,
                'academic_year_id' => $this->context->selectedYearId(),
                'stage' => $data['stage'],
            ],
            [
                'teacher_classification_id' => $category?->id,
                'basis' => $data['basis'],
                'score' => $score,
                'note' => $data['note'] ?? null,
                'created_by' => $actor->id,
                'status' => ClassificationRecord::STATUS_DRAFT,
                'approved_by' => null,
                'approved_at' => null,
            ],
        );

        if ($autoApprove) {
            $this->approve($record, $actor);
        }

        return $record->refresh();
    }

    /** اعتماد سجلّ تصنيف وتطبيق فئته على المعلم (التصنيف الفعّال). */
    public function approve(ClassificationRecord $record, User $actor): ClassificationRecord
    {
        $record->update([
            'status' => ClassificationRecord::STATUS_APPROVED,
            'approved_by' => $actor->id,
            'approved_at' => now(),
        ]);

        // التصنيف المعتمَد يصبح التصنيف الفعّال للمعلم (يغذّي متطلبات الزيارات والمؤشرات).
        if ($record->teacher_classification_id) {
            Teacher::whereKey($record->teacher_id)->update(['classification_id' => $record->teacher_classification_id]);
        }

        return $record;
    }

    /**
     * لوحة الالتزام: لكل معلم ضمن نطاق المستخدم — المطلوب (زيارات/استمارات) مقابل المنفّذ + الحالة.
     *
     * @return array{rows:list<array<string,mixed>>,stats:array<string,int|float>}
     */
    public function dashboard(User $user, ?int $departmentId = null, ?int $supervisorId = null): array
    {
        $yearId = $this->context->selectedYearId();
        if ($yearId === null) {
            return ['rows' => [], 'stats' => ['total' => 0, 'complete' => 0, 'remaining' => 0, 'late' => 0, 'completion' => 0]];
        }

        $teachers = $this->visits->applyReportScope(
            Teacher::where('is_active', true)->with(['school:id,name', 'department:id,name', 'classification']),
            $user,
        )
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId))
            ->when($supervisorId, fn ($q) => $q->whereIn('school_id', SchoolAssignment::where('supervisor_id', $supervisorId)->pluck('school_id')))
            ->orderBy('name')->get();

        $visitCounts = $this->countByTeacher($yearId, false);
        $formCounts = $this->countByTeacher($yearId, true);
        $records = $this->latestRecords($yearId, $teachers->pluck('id'));
        $semesterClosed = (bool) $this->context->selectedSemester()?->hasEnded();

        $rows = $teachers->map(function (Teacher $t) use ($visitCounts, $formCounts, $records, $semesterClosed) {
            $reqVisits = $t->classification->required_visits ?? 1;
            $reqForms = $t->classification->required_forms ?? 1;
            $doneVisits = $visitCounts[$t->id] ?? 0;
            $doneForms = $formCounts[$t->id] ?? 0;
            $record = $records[$t->id] ?? null;

            $complete = $doneVisits >= $reqVisits && $doneForms >= $reqForms;
            $status = match (true) {
                $complete => 'complete',
                $semesterClosed => 'late',
                default => 'remaining',
            };

            return [
                'teacher_id' => $t->id,
                'name' => $t->name,
                'school' => $t->school?->name,
                'department' => $t->department?->name,
                'classification' => $t->classification?->name,
                'classification_color' => $t->classification?->color,
                'required_visits' => $reqVisits,
                'done_visits' => $doneVisits,
                'required_forms' => $reqForms,
                'done_forms' => $doneForms,
                'status' => $status,
                'record_id' => $record?->id,
                'stage' => $record?->stage,
                'record_status' => $record?->status,
                'score' => $record?->score !== null ? (float) $record->score : null,
                'is_new' => $this->looksNew($t),
            ];
        })->values()->all();

        $stats = [
            'total' => count($rows),
            'complete' => count(array_filter($rows, fn ($r) => $r['status'] === 'complete')),
            'remaining' => count(array_filter($rows, fn ($r) => $r['status'] === 'remaining')),
            'late' => count(array_filter($rows, fn ($r) => $r['status'] === 'late')),
        ];
        $stats['completion'] = $stats['total'] ? round($stats['complete'] / $stats['total'] * 100, 1) : 0;

        return ['rows' => $rows, 'stats' => $stats];
    }

    /**
     * بطاقات الأقسام: لكل قسم نسبة التزام معلميه (المستوى الأعلى — رئيس التوجيه).
     *
     * @return list<array<string,mixed>>
     */
    public function departmentBoards(): array
    {
        $departments = Department::where('is_active', true)->orderBy('name')->get(['id', 'name']);
        $yearId = $this->context->selectedYearId();

        if ($yearId === null) {
            return $departments->map(fn ($d) => array_merge(['id' => $d->id, 'name' => $d->name], $this->emptyStats()))->all();
        }

        $ctx = $this->boardContext($yearId);
        $teachers = Teacher::where('is_active', true)
            ->with('classification:id,required_visits,required_forms')
            ->get(['id', 'department_id', 'school_id', 'classification_id'])
            ->groupBy('department_id');

        return $departments->map(function ($d) use ($teachers, $ctx) {
            $stats = $this->statsForTeachers($teachers->get($d->id, collect()), $ctx);

            return array_merge(['id' => $d->id, 'name' => $d->name], $stats);
        })->all();
    }

    /**
     * بطاقات الموجهين في قسم: لكل موجّه نسبة التزام معلمي مدارسه المكلّف بها.
     *
     * @return list<array<string,mixed>>
     */
    public function supervisorBoards(int $departmentId): array
    {
        $supervisors = User::where('department_id', $departmentId)
            ->where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_SUPERVISOR))
            ->orderBy('name')->get(['id', 'name', 'gender']);

        $yearId = $this->context->selectedYearId();
        if ($yearId === null || $supervisors->isEmpty()) {
            return $supervisors->map(fn ($s) => array_merge(
                ['id' => $s->id, 'name' => $s->name, 'gender' => $s->gender, 'schools' => 0],
                $this->emptyStats(),
            ))->all();
        }

        $ctx = $this->boardContext($yearId);
        $assignments = SchoolAssignment::whereIn('supervisor_id', $supervisors->pluck('id'))
            ->get(['supervisor_id', 'school_id'])->groupBy('supervisor_id');

        $schoolIds = $assignments->flatten(1)->pluck('school_id')->unique();
        $teachers = Teacher::where('is_active', true)->whereIn('school_id', $schoolIds)
            ->with('classification:id,required_visits,required_forms')
            ->get(['id', 'school_id', 'classification_id'])->groupBy('school_id');

        return $supervisors->map(function ($s) use ($assignments, $teachers, $ctx) {
            $sids = ($assignments->get($s->id) ?? collect())->pluck('school_id');
            $ts = $sids->flatMap(fn ($id) => $teachers->get($id, collect()));
            $stats = $this->statsForTeachers($ts, $ctx);

            return array_merge(['id' => $s->id, 'name' => $s->name, 'gender' => $s->gender, 'schools' => $sids->count()], $stats);
        })->all();
    }

    /** سياق العدّ المشترك للبطاقات: خريطتا الزيارات/الاستمارات + هل أُغلق الفصل. @return array<string,mixed> */
    private function boardContext(int $yearId): array
    {
        return [
            'visits' => $this->countByTeacher($yearId, false),
            'forms' => $this->countByTeacher($yearId, true),
            'semester_closed' => (bool) $this->context->selectedSemester()?->hasEnded(),
        ];
    }

    /** إحصاء التزام مجموعة معلمين (مكتمل/متبقٍّ/متأخر/نسبة) لبطاقة قسم أو موجّه. @return array<string,int|float> */
    private function statsForTeachers(Collection $teachers, array $ctx): array
    {
        $total = $teachers->count();
        $done = 0;
        $late = 0;

        foreach ($teachers as $t) {
            $reqVisits = $t->classification->required_visits ?? 1;
            $reqForms = $t->classification->required_forms ?? 1;
            $complete = ($ctx['visits'][$t->id] ?? 0) >= $reqVisits && ($ctx['forms'][$t->id] ?? 0) >= $reqForms;

            if ($complete) {
                $done++;
            } elseif ($ctx['semester_closed']) {
                $late++;
            }
        }

        return [
            'total' => $total,
            'done' => $done,
            'remaining' => $total - $done - $late,
            'late' => $late,
            'completion' => $total ? round($done / $total * 100, 1) : 0,
        ];
    }

    /** @return array<string,int|float> */
    private function emptyStats(): array
    {
        return ['total' => 0, 'done' => 0, 'remaining' => 0, 'late' => 0, 'completion' => 0];
    }

    /** عدد الزيارات (أو الاستمارات المعتمدة) لكل معلم في العام. @return array<int,int> */
    private function countByTeacher(int $yearId, bool $finalizedFormsOnly): array
    {
        return Visit::withoutAcademicContext()
            ->where('academic_year_id', $yearId)
            ->where('visitable_type', Teacher::class)
            ->when($finalizedFormsOnly, fn ($q) => $q->whereHas('form', fn ($f) => $f->where('save_status', 'final')))
            ->selectRaw('visitable_id, COUNT(*) as c')
            ->groupBy('visitable_id')
            ->pluck('c', 'visitable_id')
            ->map(fn ($c) => (int) $c)
            ->all();
    }

    /** أحدث سجلّ تصنيف لكل معلم في العام (بأولوية المرحلة: نهائي > منتصف > مبدئي). @return array<int,ClassificationRecord> */
    private function latestRecords(int $yearId, Collection $teacherIds): array
    {
        $order = [ClassificationRecord::STAGE_INITIAL => 0, ClassificationRecord::STAGE_MIDYEAR => 1, ClassificationRecord::STAGE_FINAL => 2];

        return ClassificationRecord::withoutAcademicContext()
            ->where('academic_year_id', $yearId)
            ->whereIn('teacher_id', $teacherIds)
            ->get()
            ->sortBy(fn (ClassificationRecord $r) => $order[$r->stage] ?? 0)
            ->groupBy('teacher_id')
            ->map(fn ($group) => $group->last())
            ->all();
    }
}
