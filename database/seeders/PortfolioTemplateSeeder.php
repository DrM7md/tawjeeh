<?php

namespace Database\Seeders;

use App\Models\PortfolioReviewItem;
use App\Models\PortfolioReviewTemplate;
use Illuminate\Database\Seeder;

/**
 * قالب تقييم ملفات منسق افتراضي (بنود مرنة). يصلح كنقطة بداية تُعدَّل من الإعدادات.
 */
class PortfolioTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $template = PortfolioReviewTemplate::firstOrCreate(
            ['name' => 'قالب تقييم ملفات المنسق (افتراضي)'],
            ['description' => 'قالب مرجعي لتقييم حافظة أعمال المنسق وفق بنود قابلة للضبط', 'is_active' => true]
        );

        if ($template->items()->exists()) {
            return; // البنود مُبذورة مسبقًا
        }

        $items = [
            ['اكتمال ملف المنسق وتنظيمه', 10],
            ['خطة العمل الفصلية وتنفيذها', 10],
            ['متابعة أداء المعلمين وتوثيقها', 10],
            ['تحليل نتائج الاختبارات والمعالجة', 10],
            ['الاجتماعات الفنية ومحاضرها', 5],
            ['الأنشطة والمبادرات المهنية', 5],
            ['التواصل مع الإدارة والموجّه الأول', 5],
            ['الالتزام بالتعاميم والمستجدات', 5],
        ];

        foreach ($items as $i => [$text, $max]) {
            PortfolioReviewItem::create([
                'portfolio_review_template_id' => $template->id,
                'criterion_text' => $text,
                'max_score' => $max,
                'sort_order' => $i + 1,
            ]);
        }
    }
}
