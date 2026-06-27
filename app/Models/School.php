<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Scopes\AcademicContextScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class School extends Model
{
    /** @use HasFactory<\Database\Factories\SchoolFactory> */
    use Auditable, HasFactory;

    protected $fillable = ['name', 'code', 'stage_id', 'gender', 'zone', 'email', 'address', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    // مدير العام المختار (مفلتر تلقائيًا عبر السياق على SchoolPrincipal)
    public function principal(): HasOne
    {
        return $this->hasOne(SchoolPrincipal::class);
    }

    // كل مديري المدرسة عبر الأعوام (بدون فلترة السياق) — للسجل التاريخي
    public function principals(): HasMany
    {
        return $this->hasMany(SchoolPrincipal::class)->withoutGlobalScope(AcademicContextScope::class);
    }

    // العلاقات التالية مفلترة تلقائيًا بالعام المختار (عبر Trait السياق على الموديلات المرتبطة)
    public function teachers(): HasMany
    {
        return $this->hasMany(Teacher::class);
    }

    public function coordinators(): HasMany
    {
        return $this->hasMany(Coordinator::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(SchoolAssignment::class);
    }
}
