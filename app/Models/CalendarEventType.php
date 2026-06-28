<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * نوع حدث تقويم قابل للإدارة (عام / اجتماع / إنجاز تقرير / ما يضيفه المستخدم).
 */
class CalendarEventType extends Model
{
    protected $fillable = ['name', 'color', 'has_time', 'is_default', 'sort_order'];

    protected function casts(): array
    {
        return [
            'has_time' => 'boolean',
            'is_default' => 'boolean',
        ];
    }
}
