<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

/**
 * إشعار عام قابل للضبط — يُحفظ بقاعدة البيانات دائمًا، ويُبثّ لحظيًا عند تفعيل البث للنوع.
 */
class DomainNotification extends Notification
{
    public function __construct(
        public string $typeKey,
        public string $title,
        public string $message,
        public ?string $url = null,
        public ?string $icon = null,
        public bool $live = false,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        $channels = ['database'];

        // البث فقط عند تفعيله للنوع وكون قناة البث مُهيّأة فعلًا (تجنّب الفشل بلا خادم Reverb).
        if ($this->live && config('broadcasting.default') !== 'null') {
            $channels[] = 'broadcast';
        }

        return $channels;
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => $this->typeKey,
            'title' => $this->title,
            'message' => $this->message,
            'url' => $this->url,
            'icon' => $this->icon,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
