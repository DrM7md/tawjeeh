<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** نوع متابعة (نوع الزيارة الصفية) — خيار قابل للتعديل يظهر في الاستمارة. */
class VisitFollowUpType extends Model
{
    protected $fillable = ['name', 'sort_order'];
}
