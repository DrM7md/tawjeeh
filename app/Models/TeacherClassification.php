<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * قاعدة التصنيف (الفئة): الاسم + عدد الزيارات/الاستمارات المطلوبة + حدود النِسَب المئوية.
 * تُعدَّل بالكامل من الإعدادات. المحرك يطابق درجة المعلم بالحدود لاختيار الفئة.
 */
class TeacherClassification extends Model
{
    protected $fillable = [
        'name', 'code', 'required_visits', 'required_forms', 'min_percent', 'max_percent',
        'is_default_for_new', 'color', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'required_visits' => 'integer',
            'required_forms' => 'integer',
            'min_percent' => 'integer',
            'max_percent' => 'integer',
            'is_default_for_new' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /** هل تقع النسبة المئوية ضمن نطاق هذه الفئة؟ */
    public function matchesScore(float $percent): bool
    {
        $min = $this->min_percent ?? 0;
        $max = $this->max_percent ?? 100;

        return $percent >= $min && $percent <= $max;
    }
}
