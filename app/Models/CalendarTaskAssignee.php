<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * إسناد مهمّة تقويم لمستخدم + حالة إنجازه لها.
 */
class CalendarTaskAssignee extends Model
{
    protected $fillable = ['calendar_task_id', 'user_id', 'status', 'completed_at'];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(CalendarTask::class, 'calendar_task_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
