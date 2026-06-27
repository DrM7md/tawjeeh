<?php

namespace App\Notifications;

use Illuminate\Notifications\DatabaseNotification;

/**
 * يحوّل إشعار قاعدة البيانات إلى الشكل المُرسَل للواجهة.
 */
class NotificationPresenter
{
    /** @return array<string, mixed> */
    public static function make(DatabaseNotification $n): array
    {
        $data = $n->data;

        return [
            'id' => $n->id,
            'type' => $data['type'] ?? 'bell',
            'title' => $data['title'] ?? '',
            'message' => $data['message'] ?? '',
            'url' => $data['url'] ?? null,
            'icon' => $data['icon'] ?? null,
            'read_at' => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at->toIso8601String(),
        ];
    }
}
