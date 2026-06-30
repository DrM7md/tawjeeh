<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\SchoolAssignment;
use App\Models\Teacher;
use App\Models\User;
use App\Models\Visit;
use App\Models\VisitFollowUpType;
use App\Models\VisitNotePreset;
use App\Notifications\NotificationType;
use App\Services\NotificationDispatcher;
use App\Services\VisitService;
use App\Support\SupervisionRatings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class VisitController extends Controller
{
    /** محاور التقييم الافتراضية للاستمارة. */
    public const AXES = ['التخطيط للدرس', 'إدارة الصف', 'استراتيجيات التدريس', 'التقويم', 'البيئة الصفية'];

    public function __construct(
        private readonly VisitService $service,
        private readonly NotificationDispatcher $notifications,
    ) {}

    /**
     * شاشة الزيارات متعددة المستويات حسب الدور:
     *  - رئيس التوجيه: الأقسام ← الموجهون ← زيارات الموجّه.
     *  - رئيس القسم: الموجهون (في قسمه) ← زيارات الموجّه.
     *  - الموجه: لوحته وزياراته مباشرة.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $canAll = $user->isSuper() || $user->hasPermission('visits.view.all');
        $canDept = $user->hasPermission('visits.view.department');

        // الموجه العادي: لوحته الخاصة مباشرة.
        if (! $canAll && ! $canDept) {
            return $this->visitsLevel($user, $user, null);
        }

        $supervisorId = $request->integer('supervisor') ?: null;
        // رئيس القسم مقيّد بقسمه؛ رئيس التوجيه يختار القسم.
        $departmentId = $user->department_id;
        if ($canAll) {
            $departmentId = $request->integer('department') ?: null;
        }

        // المستوى الثالث: زيارات موجّه محدد.
        if ($supervisorId) {
            $supervisor = User::findOrFail($supervisorId);
            $this->authorizeSupervisor($user, $supervisor, $canAll);

            return $this->visitsLevel($user, $supervisor, $supervisor->department_id);
        }

        // المستوى الثاني: موجهو قسم محدد.
        if ($departmentId) {
            $department = Department::findOrFail($departmentId);

            return Inertia::render('visits/index', [
                'view' => 'supervisors',
                'department' => ['id' => $department->id, 'name' => $department->name],
                'supervisors' => $this->service->supervisorBoards($department->id),
                'canDrillDepartments' => $canAll,
            ]);
        }

        // المستوى الأول: الأقسام (رئيس التوجيه فقط).
        return Inertia::render('visits/index', [
            'view' => 'departments',
            'departments' => $this->service->departmentBoards(),
        ]);
    }

    /** عرض المستوى الأخير: لوحة المتابعة + الزيارات المسجّلة لموجّه (أو للمستخدم نفسه). */
    private function visitsLevel(User $viewer, User $supervisor, ?int $departmentId): Response
    {
        $isSelf = $viewer->id === $supervisor->id;
        $department = $departmentId ? Department::find($departmentId) : null;

        return Inertia::render('visits/index', [
            'view' => 'visits',
            'followUp' => $this->service->followUp($viewer, $departmentId, $isSelf ? null : $supervisor),
            'visits' => $isSelf ? $this->service->list($viewer) : $this->service->listForSupervisor($supervisor),
            'supervisor' => $isSelf ? null : ['id' => $supervisor->id, 'name' => $supervisor->name],
            'department' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
            'canDrillDepartments' => $viewer->isSuper() || $viewer->hasPermission('visits.view.all'),
            'canDrillSupervisors' => $viewer->isSuper() || $viewer->hasPermission('visits.view.all') || $viewer->hasPermission('visits.view.department'),
        ]);
    }

    /** رئيس القسم لا يرى إلا موجهي قسمه؛ رئيس التوجيه يرى الجميع. */
    private function authorizeSupervisor(User $viewer, User $supervisor, bool $canAll): void
    {
        if ($canAll) {
            return;
        }

        abort_unless(
            $viewer->hasPermission('visits.view.department') && $supervisor->department_id === $viewer->department_id,
            403,
        );
    }

    /** شاشة استمارة الزيارة الإشرافية (إنشاء). */
    public function create(Request $request): Response
    {
        $user = $request->user();
        $teacherId = $request->integer('teacher_id') ?: null;

        $context = null;
        if ($teacherId) {
            $teacher = Teacher::find($teacherId);
            if ($teacher) {
                $this->authorizeTarget($request, $teacher);
                $context = $this->service->teacherContext($teacher);
            }
        }

        return Inertia::render('visits/form', array_merge($this->formData($user), [
            'editVisit' => null,
            'preselectedTeacherId' => $teacherId,
            'teacherContext' => $context,
        ]));
    }

    /** سياق المعلم (القالب + الإحصائيات + التوصيات السابقة) — يُجلب عند اختيار المعلم. */
    public function teacherContext(Request $request): JsonResponse
    {
        $teacher = Teacher::findOrFail($request->integer('teacher_id'));
        $this->authorizeTarget($request, $teacher);

        return response()->json($this->service->teacherContext($teacher, $request->integer('exclude_visit_id') ?: null));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateForm($request);
        $teacher = Teacher::findOrFail($data['teacher_id']);
        $this->authorizeTarget($request, $teacher);

        $visit = $this->service->saveSupervision($data, $request->user());

        $user = $request->user();
        $this->notifications->send(
            NotificationType::VISIT_ASSIGNED,
            [
                'title' => 'زيارة إشرافية جديدة',
                'message' => "سجّل {$user->name} زيارة إشرافية للمعلم: {$teacher->name}",
                'url' => route('visits.edit', $visit),
            ],
            departmentId: $visit->department_id,
            excludeUserId: $user->id,
        );

        return redirect()->route('visits.index')->with('success', 'تم حفظ الزيارة الإشرافية');
    }

    /** شاشة استمارة الزيارة (تعديل). */
    public function edit(Request $request, Visit $visit): Response
    {
        $this->authorizeView($request, $visit);
        $visit->load(['ratings', 'supervisor:id,name']);

        $teacher = Teacher::withoutAcademicContext()->find($visit->visitable_id);
        abort_unless($teacher, 404);

        return Inertia::render('visits/form', array_merge($this->formData($request->user()), [
            'editVisit' => [
                'id' => $visit->id,
                'teacher_id' => $visit->visitable_id,
                'teacher_name' => $teacher->name,
                'visit_date' => $visit->visit_date?->toDateString(),
                'follow_up_type' => $visit->follow_up_type,
                'section' => $visit->section,
                'lesson_topic' => $visit->lesson_topic,
                'general_notes' => $visit->form?->general_notes,
                'ratings' => $visit->ratings->map(fn ($r) => [
                    'standard_id' => $r->visit_standard_id,
                    'rating_value' => $r->rating_value,
                    'recommendation' => $r->recommendation,
                ])->values(),
            ],
            'preselectedTeacherId' => $visit->visitable_id,
            'teacherContext' => $this->service->teacherContext($teacher, $visit->id),
        ]));
    }

    public function update(Request $request, Visit $visit): RedirectResponse
    {
        $this->authorizeView($request, $visit);
        $data = $this->validateForm($request);
        $this->service->saveSupervision($data, $request->user(), $visit);

        return redirect()->route('visits.index')->with('success', 'تم تحديث الزيارة الإشرافية');
    }

    /** عرض الزيارة: حاليًا يُحوّل لشاشة الاستمارة (سيُستبدل بعرض للقراءة لاحقًا). */
    public function show(Request $request, Visit $visit): RedirectResponse
    {
        $this->authorizeView($request, $visit);

        return redirect()->route('visits.edit', $visit);
    }

    /** قالب طباعة استمارة الزيارة الإشرافية (تُفتح في تبويب جديد). */
    public function printVisit(Request $request, Visit $visit): Response
    {
        $this->authorizeView($request, $visit);
        $visit->load([
            'ratings.standard.domain',
            'supervisor:id,name', 'school:id,name', 'department:id,name',
            'form:id,visit_id,general_notes',
        ]);

        $teacher = Teacher::withoutAcademicContext()->find($visit->visitable_id);

        $domains = $visit->ratings
            ->sortBy(fn ($r) => $r->standard?->sort_order)
            ->groupBy(fn ($r) => $r->standard?->visit_domain_id)
            ->map(function ($ratings) {
                $domain = $ratings->first()->standard?->domain;

                return [
                    'name' => $domain?->name ?? '—',
                    'percent' => SupervisionRatings::percent($ratings->pluck('rating_value')->all()),
                    'standards' => $ratings->map(fn ($r) => [
                        'name' => $r->standard?->name,
                        'rating' => $r->rating_value,
                        'recommendation' => $r->recommendation,
                    ])->values()->all(),
                ];
            })->values()->all();

        return Inertia::render('visits/visit-print', [
            'visit' => [
                'school' => $visit->school?->name,
                'department' => $visit->department?->name,
                'supervisor' => $visit->supervisor?->name,
                'teacher' => $teacher?->name,
                'visit_date' => $visit->visit_date?->toDateString(),
                'day_name' => $this->arabicDay($visit->visit_date),
                'hijri_date' => $this->hijriDate($visit->visit_date),
                'visit_number' => $visit->visit_number,
                'follow_up_type' => $visit->follow_up_type,
                'section' => $visit->section,
                'lesson_topic' => $visit->lesson_topic,
                'overall_rating' => $visit->overall_rating !== null ? (float) $visit->overall_rating : null,
            ],
            'domains' => $domains,
            'ratingLabels' => SupervisionRatings::LABELS,
            'generalNotes' => $visit->form?->general_notes,
        ]);
    }

    /** اسم اليوم بالعربية من تاريخ الزيارة. */
    private function arabicDay(?\Illuminate\Support\Carbon $date): ?string
    {
        if (! $date || ! class_exists(\IntlDateFormatter::class)) {
            return null;
        }

        return \IntlDateFormatter::create('ar', \IntlDateFormatter::FULL, \IntlDateFormatter::NONE, 'Asia/Qatar', \IntlDateFormatter::GREGORIAN, 'EEEE')
            ->format($date);
    }

    /** التاريخ الهجري (أم القرى) بصيغة 1447-05-21. */
    private function hijriDate(?\Illuminate\Support\Carbon $date): ?string
    {
        if (! $date || ! class_exists(\IntlDateFormatter::class)) {
            return null;
        }

        return \IntlDateFormatter::create('en_US@calendar=islamic-umalqura', \IntlDateFormatter::NONE, \IntlDateFormatter::NONE, 'Asia/Qatar', \IntlDateFormatter::TRADITIONAL, 'yyyy-MM-dd')
            ->format($date);
    }

    /** البيانات المشتركة لشاشة الاستمارة. @return array<string,mixed> */
    private function formData($user): array
    {
        return [
            'teachers' => $this->service->teachersInScope($user),
            'followUpTypes' => VisitFollowUpType::orderBy('sort_order')->pluck('name'),
            'notePresets' => VisitNotePreset::orderBy('sort_order')->pluck('text'),
            'ratingLabels' => SupervisionRatings::LABELS,
            'visitorName' => $user->name,
        ];
    }

    /** @return array<string,mixed> */
    private function validateForm(Request $request): array
    {
        return $request->validate([
            'teacher_id' => ['required', 'exists:teachers,id'],
            'visit_date' => ['required', 'date'],
            'follow_up_type' => ['nullable', 'string', 'max:100'],
            'section' => ['nullable', 'string', 'max:100'],
            'lesson_topic' => ['nullable', 'string', 'max:255'],
            'general_notes' => ['nullable', 'string'],
            'ratings' => ['array'],
            'ratings.*.standard_id' => ['required', 'integer'],
            'ratings.*.rating_value' => ['required', 'integer', 'min:0', 'max:4'],
            'ratings.*.recommendation' => ['nullable', 'string'],
        ]);
    }

    public function destroy(Request $request, Visit $visit): RedirectResponse
    {
        $this->authorizeView($request, $visit);
        $visit->delete();

        return redirect()->route('visits.index')->with('success', 'تم حذف الزيارة');
    }

    /** الموجه يسجّل فقط لمدارسه المكلّف بها. */
    private function authorizeTarget(Request $request, $target): void
    {
        $user = $request->user();
        if ($user->isSuper() || $user->hasPermission('visits.view.all')) {
            return;
        }
        if ($user->hasPermission('visits.view.department') && $user->department_id === $target->department_id) {
            return;
        }
        $assigned = SchoolAssignment::where('supervisor_id', $user->id)->where('school_id', $target->school_id)->exists();
        abort_unless($assigned, 403, 'هذه المدرسة ليست ضمن مدارسك');
    }

    private function authorizeView(Request $request, Visit $visit): void
    {
        $user = $request->user();
        $ok = $user->isSuper()
            || $user->hasPermission('visits.view.all')
            || ($user->hasPermission('visits.view.department') && $visit->department_id === $user->department_id)
            || $visit->supervisor_id === $user->id;
        abort_unless($ok, 403);
    }
}
