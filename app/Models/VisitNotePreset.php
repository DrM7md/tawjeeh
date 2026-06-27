<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** نص جاهز عام للملاحظات/التوصيات في الاستمارة. */
class VisitNotePreset extends Model
{
    protected $fillable = ['text', 'sort_order'];
}
