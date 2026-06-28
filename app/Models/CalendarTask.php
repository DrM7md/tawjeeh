<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * مهمّة تقويم — شخصية أو مُسندة. تتبّع الإنجاز عبر علاقة assignees.
 */
class CalendarTask extends Model
{
    protected $fillable = [
        'creator_id', 'title', 'description', 'calendar_event_type_id', 'priority',
        'audience', 'color', 'start_date', 'due_date', 'start_time',
        'end_time', 'location', 'department_id',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'due_date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function eventType(): BelongsTo
    {
        return $this->belongsTo(CalendarEventType::class, 'calendar_event_type_id');
    }

    public function assignees(): HasMany
    {
        return $this->hasMany(CalendarTaskAssignee::class);
    }

    public function isPersonal(): bool
    {
        return $this->audience === 'personal';
    }
}
