<?php

namespace App\Models\Concerns;

use App\Models\AuditLog;

/**
 * يسجّل تلقائيًا عمليات الإنشاء/التعديل/الحذف في audit_logs. (X-1)
 * الحقول الحسّاسة تُحجب.
 */
trait Auditable
{
    private const HIDDEN_AUDIT = ['password', 'remember_token'];

    public static function bootAuditable(): void
    {
        static::created(fn ($model) => $model->writeAudit('created', null, $model->getAttributes()));
        static::updated(fn ($model) => $model->writeAudit('updated', $model->getOriginal(), $model->getChanges()));
        static::deleted(fn ($model) => $model->writeAudit('deleted', $model->getOriginal(), null));
    }

    protected function writeAudit(string $action, ?array $old, ?array $new): void
    {
        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => $action,
            'auditable_type' => static::class,
            'auditable_id' => $this->getKey(),
            'old_values' => $this->scrub($old),
            'new_values' => $this->scrub($new),
            'ip_address' => request()->ip(),
            'user_agent' => substr((string) request()->userAgent(), 0, 255),
        ]);
    }

    private function scrub(?array $values): ?array
    {
        if ($values === null) {
            return null;
        }

        return collect($values)->except(self::HIDDEN_AUDIT)->all();
    }
}
