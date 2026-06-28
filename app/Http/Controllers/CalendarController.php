<?php

namespace App\Http\Controllers;

use App\Models\CalendarEventType;
use App\Models\CalendarTask;
use App\Models\CalendarTaskAssignee;
use App\Models\User;
use App\Notifications\NotificationType;
use App\Services\NotificationDispatcher;
use App\Support\Permissions;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * التقويم — مهام شخصية ومُسندة بتتبّع الإنجاز، سحب وإفلات، وربط بالإشعارات.
 */
class CalendarController extends Controller
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        // المرئيّ للمستخدم: ما أنشأه (يتتبّعه) + ما أُسند إليه.
        $tasks = CalendarTask::query()
            ->with(['creator:id,name', 'eventType:id,name,color,has_time', 'assignees.user:id,name,department_id', 'assignees.user.department:id,name'])
            ->where(fn ($q) => $q
                ->where('creator_id', $user->id)
                ->orWhereHas('assignees', fn ($a) => $a->where('user_id', $user->id)))
            ->orderBy('start_date')
            ->get()
            ->map(fn (CalendarTask $t) => $this->present($t, $user->id))
            ->all();

        $canAssign = $user->hasPermission('calendar.assign');

        return Inertia::render('calendar/index', [
            'tasks' => $tasks,
            'canAssign' => $canAssign,
            'canManageTypes' => $user->hasPermission('settings.manage'),
            'eventTypes' => CalendarEventType::orderBy('sort_order')->get(['id', 'name', 'color', 'has_time', 'is_default']),
            // قائمة المستخدمين القابلين للإسناد (للقائمة المنسدلة القابلة للبحث) — تُجلب فقط لمن يملك الإسناد
            'assignableUsers' => $canAssign
                ? User::query()
                    ->where('is_active', true)
                    ->whereKeyNot($user->id)
                    ->with('department:id,name')
                    ->orderBy('name')
                    ->get(['id', 'name', 'department_id'])
                    ->map(fn (User $u) => [
                        'id' => $u->id,
                        'name' => $u->name,
                        'department' => $u->department?->name,
                    ])
                : [],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $this->validateTask($request);

        // إسناد لغير النفس يتطلب صلاحية الإسناد.
        if ($data['audience'] !== 'personal' && ! $user->hasPermission('calendar.assign')) {
            abort(403);
        }

        $task = DB::transaction(function () use ($data, $user) {
            $task = CalendarTask::create([
                ...$data,
                'creator_id' => $user->id,
                'department_id' => $user->department_id,
            ]);

            $this->syncAssignees($task, $data['audience'], $data['assignee_ids'] ?? [], $user->id);

            return $task;
        });

        $this->notifyAssignees($task, $user->id);

        return back()->with('success', 'تمت إضافة المهمة');
    }

    public function update(Request $request, CalendarTask $task): RedirectResponse
    {
        $this->authorizeOwner($task, $request->user()->id);

        $data = $this->validateTask($request);

        if ($data['audience'] !== 'personal' && ! $request->user()->hasPermission('calendar.assign')) {
            abort(403);
        }

        DB::transaction(function () use ($task, $data, $request) {
            $task->update($data);
            $this->syncAssignees($task, $data['audience'], $data['assignee_ids'] ?? [], $request->user()->id);
        });

        $this->notifyAssignees($task->refresh(), $request->user()->id);

        return back()->with('success', 'تم تحديث المهمة');
    }

    /** نقل المهمة إلى يوم آخر (سحب وإفلات) — للمُنشئ فقط. */
    public function move(Request $request, CalendarTask $task): RedirectResponse
    {
        $this->authorizeOwner($task, $request->user()->id);

        $data = $request->validate([
            'start_date' => ['required', 'date'],
        ]);

        // إن أصبح موعد الانتهاء قبل تاريخ البدء الجديد، حاذِه معه.
        $update = ['start_date' => $data['start_date']];
        if ($task->due_date && $task->due_date->toDateString() < $data['start_date']) {
            $update['due_date'] = $data['start_date'];
        }
        $task->update($update);

        return back();
    }

    /** المُسنَد إليه يبدّل حالة إنجازه للمهمة. */
    public function toggle(Request $request, CalendarTask $task): RedirectResponse
    {
        $assignee = CalendarTaskAssignee::where('calendar_task_id', $task->id)
            ->where('user_id', $request->user()->id)
            ->first();

        abort_if($assignee === null, 403);

        $done = $assignee->status !== 'done';
        $assignee->update([
            'status' => $done ? 'done' : 'pending',
            'completed_at' => $done ? now() : null,
        ]);

        return back();
    }

    public function destroy(Request $request, CalendarTask $task): RedirectResponse
    {
        $this->authorizeOwner($task, $request->user()->id);
        $task->delete();

        return back()->with('success', 'تم حذف المهمة');
    }

    private function authorizeOwner(CalendarTask $task, int $userId): void
    {
        abort_unless($task->creator_id === $userId, 403);
    }

    /** @return array<string, mixed> */
    private function validateTask(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'calendar_event_type_id' => ['nullable', 'exists:calendar_event_types,id'],
            'priority' => ['required', Rule::in(['normal', 'medium', 'urgent', 'critical'])],
            'audience' => ['required', Rule::in(['personal', 'all', 'department_heads', 'specific'])],
            'color' => ['nullable', 'string', 'max:20'],
            'start_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i', 'after_or_equal:start_time'],
            'location' => ['nullable', 'string', 'max:255'],
            'assignee_ids' => ['nullable', 'array'],
            'assignee_ids.*' => ['integer', 'exists:users,id'],
        ]);
    }

    /**
     * يضبط المُسنَد إليهم حسب الجمهور مع الحفاظ على حالات الإنجاز السابقة.
     *
     * @param  list<int>  $specificIds
     */
    private function syncAssignees(CalendarTask $task, string $audience, array $specificIds, int $creatorId): void
    {
        if ($audience === 'personal') {
            // المهمة الشخصية يُنجِزها مُنشئها — صف إسناد واحد له لتتبّع حالته (شطب/إنجاز).
            $task->assignees()->where('user_id', '!=', $creatorId)->delete();
            $task->assignees()->firstOrCreate(['user_id' => $creatorId], ['status' => 'pending']);

            return;
        }

        $targetIds = $this->resolveAudienceUserIds($audience, $specificIds, $creatorId);

        // أبقِ صفوف الإنجاز القائمة، واحذف من خرج، وأضِف من دخل.
        $existing = $task->assignees()->pluck('user_id')->all();
        $toRemove = array_diff($existing, $targetIds);
        $toAdd = array_diff($targetIds, $existing);

        if ($toRemove) {
            $task->assignees()->whereIn('user_id', $toRemove)->delete();
        }
        foreach ($toAdd as $uid) {
            $task->assignees()->create(['user_id' => $uid, 'status' => 'pending']);
        }
    }

    /**
     * يحوّل الجمهور إلى قائمة معرّفات مستخدمين فعليّين (لقطة لحظة الإنشاء).
     *
     * @param  list<int>  $specificIds
     * @return list<int>
     */
    private function resolveAudienceUserIds(string $audience, array $specificIds, int $creatorId): array
    {
        $query = User::query()->where('is_active', true)->whereKeyNot($creatorId);

        if ($audience === 'all') {
            return $query->pluck('id')->all();
        }

        if ($audience === 'department_heads') {
            return $query
                ->whereHas('roles', fn ($q) => $q->where('name', Permissions::ROLE_DEPARTMENT_HEAD))
                ->pluck('id')->all();
        }

        // specific
        return $query->whereIn('id', $specificIds)->pluck('id')->all();
    }

    /** يُشعر المُسنَد إليهم الحاليين (عدا المُنشئ). */
    private function notifyAssignees(CalendarTask $task, int $creatorId): void
    {
        $userIds = $task->assignees()->pluck('user_id')->reject(fn ($id) => $id === $creatorId)->all();
        if (empty($userIds)) {
            return;
        }

        /** @var Collection<int, User> $users */
        $users = User::whereIn('id', $userIds)->get();

        $due = $task->due_date ? ' — الموعد النهائي: '.$task->due_date->toDateString() : '';

        $this->dispatcher->sendToUsers(NotificationType::TASK_ASSIGNED, [
            'title' => 'مهمة جديدة: '.$task->title,
            'message' => 'أُسندت إليك مهمة جديدة في التقويم'.$due,
            'url' => '/calendar',
        ], $users);
    }

    /** @return array<string, mixed> */
    private function present(CalendarTask $task, int $userId): array
    {
        $assignees = $task->assignees->map(fn (CalendarTaskAssignee $a) => [
            'id' => $a->user_id,
            'name' => $a->user?->name,
            'department' => $a->user?->department?->name,
            'status' => $a->status,
            'completed_at' => $a->completed_at?->toIso8601String(),
        ])->values();

        $mine = $task->assignees->firstWhere('user_id', $userId);

        return [
            'id' => $task->id,
            'title' => $task->title,
            'description' => $task->description,
            'event_type' => $task->eventType ? [
                'id' => $task->eventType->id,
                'name' => $task->eventType->name,
                'color' => $task->eventType->color,
                'has_time' => $task->eventType->has_time,
            ] : null,
            'priority' => $task->priority,
            'audience' => $task->audience,
            'color' => $task->color,
            'start_date' => $task->start_date?->toDateString(),
            'due_date' => $task->due_date?->toDateString(),
            'start_time' => $task->start_time ? substr((string) $task->start_time, 0, 5) : null,
            'end_time' => $task->end_time ? substr((string) $task->end_time, 0, 5) : null,
            'location' => $task->location,
            'creator' => ['id' => $task->creator_id, 'name' => $task->creator?->name],
            'can_edit' => $task->creator_id === $userId,
            'assignees' => $assignees,
            'assignee_ids' => $assignees->pluck('id')->all(),
            'done_count' => $task->assignees->where('status', 'done')->count(),
            'total_count' => $task->assignees->count(),
            'my_status' => $mine?->status,
        ];
    }
}
