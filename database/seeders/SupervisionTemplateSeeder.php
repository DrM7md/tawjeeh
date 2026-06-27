<?php

namespace Database\Seeders;

use App\Models\VisitDomain;
use App\Models\VisitFollowUpType;
use App\Models\VisitNotePreset;
use App\Models\VisitStandard;
use App\Models\VisitTemplate;
use Illuminate\Database\Seeder;

/**
 * قالب إشراف افتراضي (مجالات ← معايير) + نصوص ملاحظات جاهزة.
 * يصلح كنقطة بداية تُنسخ/تُعدّل لكل قسم من شاشة الإعدادات.
 */
class SupervisionTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $template = VisitTemplate::firstOrCreate(
            ['name' => 'قالب الزيارة الصفية (افتراضي)'],
            ['description' => 'قالب مرجعي لتقييم أداء المعلم في الزيارة الصفية', 'is_active' => true]
        );

        $this->seedNotePresetsAndTypes();

        if ($template->domains()->exists()) {
            return; // المجالات مُبذورة مسبقًا
        }

        $structure = [
            'التخطيط للدرس' => [
                'وضوح الأهداف التعليمية وقابليتها للقياس',
                'مناسبة الاستراتيجيات لمحتوى الدرس',
                'توافر خطة زمنية متوازنة للحصة',
            ],
            'إدارة الصف والبيئة الصفية' => [
                'ضبط الصف وتنظيم سلوك الطلبة',
                'تهيئة بيئة صفية محفّزة وآمنة',
                'استثمار وقت الحصة بفاعلية',
            ],
            'استراتيجيات التدريس' => [
                'تنويع أساليب التدريس بما يراعي الفروق الفردية',
                'تفعيل التعلم النشط ومشاركة الطلبة',
                'توظيف الوسائل والتقنيات التعليمية',
            ],
            'التقويم' => [
                'تنوّع أساليب التقويم خلال الحصة',
                'تقديم تغذية راجعة فورية ومناسبة',
                'ربط التقويم بالأهداف التعليمية',
            ],
        ];

        $domainSort = 0;
        foreach ($structure as $domainName => $standards) {
            $domain = VisitDomain::create([
                'visit_template_id' => $template->id,
                'name' => $domainName,
                'sort_order' => ++$domainSort,
            ]);

            foreach ($standards as $i => $standardName) {
                VisitStandard::create([
                    'visit_domain_id' => $domain->id,
                    'name' => $standardName,
                    'sort_order' => $i + 1,
                ]);
            }
        }
    }

    /** النصوص الجاهزة وأنواع المتابعة — تُبذر دائمًا (مستقلة عن مجالات القالب). */
    private function seedNotePresetsAndTypes(): void
    {
        $presets = [
            'استمرار التطوير المهني وحضور الورش التدريبية.',
            'تنويع استراتيجيات التدريس بما يراعي الفروق الفردية.',
            'الاهتمام بالتغذية الراجعة الفورية للطلبة.',
            'تفعيل أدوات التقويم المتنوعة خلال الحصة.',
        ];
        foreach ($presets as $i => $text) {
            VisitNotePreset::firstOrCreate(['text' => $text], ['sort_order' => $i + 1]);
        }

        // أنواع المتابعة الافتراضية (قابلة للتعديل من الإعدادات)
        foreach (['زيارة صفية', 'متابعة', 'زيارة تعزيزية', 'مشاهدة تبادلية'] as $i => $name) {
            VisitFollowUpType::firstOrCreate(['name' => $name], ['sort_order' => $i + 1]);
        }
    }
}
