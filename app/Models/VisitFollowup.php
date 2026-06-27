<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** متابعة تنفيذ توصيات مجال في زيارة لاحقًا. */
class VisitFollowup extends Model
{
    protected $fillable = ['visit_id', 'visit_domain_id', 'status'];

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    public function domain(): BelongsTo
    {
        return $this->belongsTo(VisitDomain::class, 'visit_domain_id');
    }
}
