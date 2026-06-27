<?php

namespace App\Support;

/**
 * مستويات تقييم المعايير (0–4) ومنطق احتساب النسبة المئوية.
 * 0 = غير مقيّم (يُستثنى من الحساب)، 4 = الأعلى.
 */
class SupervisionRatings
{
    /** التسميات لكل مستوى (1..4). @var array<int,string> */
    public const LABELS = [
        4 => 'ممتاز',
        3 => 'جيد جدًا',
        2 => 'جيد',
        1 => 'ضعيف',
    ];

    /** حالات متابعة تنفيذ التوصيات. @var array<string,string> */
    public const FOLLOWUP_STATUSES = [
        'pending' => 'بانتظار المتابعة',
        'full' => 'نُفِّذت بالكامل',
        'mostly' => 'نُفِّذت غالبًا',
        'partially' => 'نُفِّذت جزئيًا',
        'not_done' => 'لم تُنفَّذ',
    ];

    /**
     * النسبة المئوية من درجات المعايير: (مجموع المقيَّم ÷ (العدد × 4)) × 100.
     * يتجاهل الدرجات = 0 (غير المقيّمة). يعيد null إن لم يُقيَّم أي معيار.
     *
     * @param  iterable<int>  $values
     */
    public static function percent(iterable $values): ?float
    {
        $measured = array_filter(array_map('intval', is_array($values) ? $values : iterator_to_array($values)), fn ($v) => $v > 0);

        if ($measured === []) {
            return null;
        }

        return round(array_sum($measured) / (count($measured) * 4) * 100, 1);
    }
}
