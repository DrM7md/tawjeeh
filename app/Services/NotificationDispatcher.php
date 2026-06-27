<?php

namespace App\Services;

use App\Models\NotificationSetting;
use App\Models\User;
use App\Notifications\DomainNotification;
use App\Notifications\NotificationType;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Notification;

/**
 * يُرسل إشعارات النظام حسب الضبط: من يستلم، وهل النوع مفعّل، وهل يُبثّ لحظيًا.
 */
class NotificationDispatcher
{
    /**
     * يرسل إشعارًا من نوع معيّن للمستلمين المحدّدين في الإعدادات.
     *
     * @param  array{title:string, message:string, url?:string|null}  $payload
     * @param  int|null  $departmentId  قسم الحدث (لحصر المستلمين عند تفعيل نطاق القسم)
     * @param  int|null  $excludeUserId  مستخدم لا يُشعَر (عادةً منشئ الحدث نفسه)
     */
    public function send(string $type, array $payload, ?int $departmentId = null, ?int $excludeUserId = null): void
    {
        $config = NotificationSetting::for($type);

        if ($config === null || ! $config['enabled'] || empty($config['recipient_roles'])) {
            return;
        }

        $recipients = $this->recipients(
            $config['recipient_roles'],
            $config['department_scoped'] ? $departmentId : null,
            $excludeUserId,
        );

        if ($recipients->isEmpty()) {
            return;
        }

        $def = NotificationType::definition($type);

        Notification::send($recipients, new DomainNotification(
            typeKey: $type,
            title: $payload['title'],
            message: $payload['message'],
            url: $payload['url'] ?? null,
            icon: $def['icon'] ?? null,
            live: (bool) $config['live'],
        ));
    }

    /**
     * المستخدمون النشطون الحاملون لأحد الأدوار، محصورين بنطاق القسم عند الطلب.
     *
     * @param  list<string>  $roles
     * @return Collection<int, User>
     */
    private function recipients(array $roles, ?int $departmentId, ?int $excludeUserId): Collection
    {
        return User::query()
            ->where('is_active', true)
            ->when($excludeUserId, fn ($q) => $q->whereKeyNot($excludeUserId))
            ->whereHas('roles', fn ($q) => $q->whereIn('name', $roles))
            ->when($departmentId, function ($q) use ($departmentId) {
                // داخل القسم، أو أدوار إشرافية عُليا بلا قسم (رئيس التوجيه/المساعد).
                $q->where(fn ($w) => $w->where('department_id', $departmentId)->orWhereNull('department_id'));
            })
            ->get();
    }
}
