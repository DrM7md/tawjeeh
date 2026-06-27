<?php

namespace Database\Seeders;

use App\Models\ReviewDomain;
use Illuminate\Database\Seeder;

/**
 * استمارة تحكيم واعتماد الاختبارات الرسمية (قطر) — المجال ← البنود ← المؤشرات.
 * idempotent: يحدّث بالاسم دون حذف، حفاظًا على المعرّفات المرتبطة بالاستمارات المعبّأة.
 */
class ReviewFormSeeder extends Seeder
{
    /** مؤشرات نوعية شائعة (3 مستويات) — الوزن تنازلي. */
    private const TRIPLE = [
        ['دقيقة', 2],
        ['يحتاج بعضها إلى تعديل', 1],
        ['معظمها يحتاج إلى تعديل', 0],
    ];

    public function run(): void
    {
        $structure = [
            [
                'name' => 'الجانب التنظيمي',
                'kind' => 'rating',
                'items' => [
                    [
                        'name' => 'التنسيق العام',
                        'description' => 'الغلاف – التعليمات – الصور والأشكال - قالب الاختبار – خريطة الاختبار',
                        'indicators' => [['مُنسَّق', 2], ['مُنسَّق إلى حد ما', 1], ['غير مُنسَّق', 0]],
                    ],
                ],
            ],
            [
                'name' => 'الأسئلة',
                'kind' => 'rating',
                'items' => [
                    ['name' => 'جودة الأسئلة ودقة صياغتها ووضوحها', 'description' => null, 'indicators' => self::TRIPLE],
                    ['name' => 'مستويات العمق المعرفي', 'description' => null, 'indicators' => self::TRIPLE],
                    ['name' => 'مطابقة الأسئلة لمعايير المادة', 'description' => null, 'indicators' => self::TRIPLE],
                ],
            ],
            [
                'name' => 'نموذج الإجابة',
                'kind' => 'rating',
                'items' => [
                    ['name' => 'دقة إجابات الأسئلة', 'description' => null, 'indicators' => self::TRIPLE],
                    ['name' => 'توزيع الدرجات', 'description' => null, 'indicators' => [['مطابقة', 1], ['غير مطابقة', 0]]],
                ],
            ],
            [
                'name' => 'الاعتماد',
                'kind' => 'approval',
                'items' => [
                    ['name' => 'اعتماد المنسق', 'description' => null, 'indicators' => [['معتمد', 1], ['غير معتمد', 0]]],
                    ['name' => 'اعتماد الموجه التربوي', 'description' => null, 'indicators' => [['معتمد', 1], ['غير معتمد', 0]]],
                ],
            ],
        ];

        foreach ($structure as $di => $domainData) {
            $domain = ReviewDomain::updateOrCreate(
                ['name' => $domainData['name']],
                ['kind' => $domainData['kind'], 'sort_order' => $di + 1],
            );

            foreach ($domainData['items'] as $ii => $itemData) {
                $item = $domain->items()->updateOrCreate(
                    ['name' => $itemData['name']],
                    ['description' => $itemData['description'], 'sort_order' => $ii + 1],
                );

                foreach ($itemData['indicators'] as $ni => [$label, $weight]) {
                    $item->indicators()->updateOrCreate(
                        ['label' => $label],
                        ['weight' => $weight, 'sort_order' => $ni + 1],
                    );
                }
            }
        }
    }
}
