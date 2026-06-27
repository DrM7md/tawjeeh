<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    use Auditable;

    protected $fillable = ['name', 'code', 'head_user_id', 'color', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function head(): BelongsTo
    {
        return $this->belongsTo(User::class, 'head_user_id');
    }

    /** قالب الإشراف المرتبط بهذا القسم (يُحمّل تلقائيًا في استمارة الزيارة). */
    public function visitTemplates(): BelongsToMany
    {
        return $this->belongsToMany(VisitTemplate::class, 'visit_template_department');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
