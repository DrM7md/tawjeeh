<?php

namespace App\Models;

use App\Notifications\NotificationType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * ضبط نوع إشعار واحد. الصفوف المفقودة تعود لافتراضيات NotificationType.
 */
class NotificationSetting extends Model
{
    protected $fillable = ['type', 'enabled', 'recipient_roles', 'department_scoped', 'live'];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'department_scoped' => 'boolean',
            'live' => 'boolean',
            'recipient_roles' => 'array',
        ];
    }

    /**
     * كل الأنواع مدموجة: إعدادات قاعدة البيانات فوق الافتراضيات.
     *
     * @return Collection<int, array{type:string,label:string,description:string,enabled:bool,recipient_roles:list<string>,department_scoped:bool,live:bool}>
     */
    public static function resolved(): Collection
    {
        $saved = static::all()->keyBy('type');

        return collect(NotificationType::catalog())
            ->map(function (array $def, string $type) use ($saved) {
                $row = $saved->get($type);

                return [
                    'type' => $type,
                    'label' => $def['label'],
                    'description' => $def['description'],
                    'enabled' => $row?->enabled ?? true,
                    'recipient_roles' => $row?->recipient_roles ?? $def['default_roles'],
                    'department_scoped' => $row?->department_scoped ?? $def['default_department_scoped'],
                    'live' => $row?->live ?? false,
                ];
            })
            ->values();
    }

    /**
     * الضبط الفعّال لنوع واحد (مدموجًا مع الافتراضيات).
     *
     * @return array{type:string,label:string,description:string,enabled:bool,recipient_roles:list<string>,department_scoped:bool,live:bool}|null
     */
    public static function for(string $type): ?array
    {
        return static::resolved()->firstWhere('type', $type);
    }
}
