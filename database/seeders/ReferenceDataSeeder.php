<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\Department;
use App\Models\Grade;
use App\Models\Role;
use App\Models\Semester;
use App\Models\Stage;
use App\Models\TeacherClassification;
use App\Support\Permissions;
use Illuminate\Database\Seeder;

class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        // المراحل الدراسية
        $stages = [
            ['name' => 'ابتدائي', 'code' => 'primary', 'sort_order' => 1],
            ['name' => 'إعدادي', 'code' => 'preparatory', 'sort_order' => 2],
            ['name' => 'ثانوي', 'code' => 'secondary', 'sort_order' => 3],
        ];
        foreach ($stages as $stage) {
            Stage::updateOrCreate(['code' => $stage['code']], $stage);
        }

        // الصفوف الدراسية مرتبطة بمراحلها — مع مسارات للصفوف الثانوية العليا
        $secondaryTracks = ['عام', 'أدبي', 'علمي', 'تكنولوجي'];
        $grades = [
            'primary' => ['الروضة', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'],
            'preparatory' => ['السابع', 'الثامن', 'التاسع'],
            'secondary' => ['العاشر', 'الحادي عشر', 'الثاني عشر'],
        ];
        $sort = 0;
        foreach ($grades as $stageCode => $names) {
            $stageId = Stage::where('code', $stageCode)->value('id');
            foreach ($names as $name) {
                $grade = Grade::updateOrCreate(
                    ['name' => $name],
                    ['stage_id' => $stageId, 'sort_order' => ++$sort]
                );

                // المسارات للحادي عشر والثاني عشر فقط (العاشر بدون مسارات)
                if ($stageCode === 'secondary' && $name !== 'العاشر') {
                    foreach ($secondaryTracks as $i => $track) {
                        $grade->tracks()->updateOrCreate(['name' => $track], ['sort_order' => $i + 1]);
                    }
                }
            }
        }

        // تصنيفات المعلمين = قواعد التصنيف (القسم 3 من الدليل) — قابلة للتعديل من الإعدادات
        $classifications = [
            ['name' => 'الدعم المكثف', 'code' => 'needs_support', 'required_visits' => 3, 'required_forms' => 2, 'min_percent' => 0, 'max_percent' => 75, 'is_default_for_new' => true, 'color' => '#FF3B30', 'sort_order' => 1],
            ['name' => 'الدعم العام', 'code' => 'average', 'required_visits' => 2, 'required_forms' => 1, 'min_percent' => 76, 'max_percent' => 92, 'is_default_for_new' => false, 'color' => '#FF9F0A', 'sort_order' => 2],
            ['name' => 'التطوير الذاتي', 'code' => 'distinguished', 'required_visits' => 1, 'required_forms' => 1, 'min_percent' => 93, 'max_percent' => 100, 'is_default_for_new' => false, 'color' => '#34C759', 'sort_order' => 3],
        ];
        foreach ($classifications as $c) {
            TeacherClassification::updateOrCreate(['code' => $c['code']], $c);
        }

        // استمارة تحكيم الاختبارات الرسمية (المجالات/البنود/المؤشرات) — قابلة للتعديل من الإعدادات
        $this->call(ReviewFormSeeder::class);

        // الأقسام العشرة
        $departments = [
            'التربية الإسلامية', 'اللغة العربية', 'اللغة الإنجليزية', 'العلوم',
            'الدراسات الاجتماعية', 'الرياضيات', 'الحوسبة وتكنولوجيا المعلومات',
            'الفنون البصرية', 'التربية البدنية', 'التربية الخاصة',
        ];
        foreach ($departments as $name) {
            Department::updateOrCreate(['name' => $name], ['is_active' => true]);
        }

        // الأدوار النظامية + صلاحياتها الافتراضية
        $roles = [
            Permissions::ROLE_HEAD => ['display_name' => 'رئيس التوجيه', 'level' => 1],
            Permissions::ROLE_ASSISTANT => ['display_name' => 'مساعد رئيس التوجيه', 'level' => 1],
            Permissions::ROLE_DEPARTMENT_HEAD => ['display_name' => 'رئيس القسم', 'level' => 2],
            Permissions::ROLE_SUPERVISOR => ['display_name' => 'موجه', 'level' => 3],
        ];
        $defaults = Permissions::defaults();
        foreach ($roles as $name => $meta) {
            Role::updateOrCreate(['name' => $name], [
                'display_name' => $meta['display_name'],
                'level' => $meta['level'],
                'permissions' => $defaults[$name] ?? [],
                'is_system' => true,
            ]);
        }

        // العام الدراسي النشط + فصلان (الأول نشط) — AY-1 / SM-2
        $year = AcademicYear::updateOrCreate(
            ['name' => '2026–2027'],
            ['start_date' => '2026-08-01', 'end_date' => '2027-06-30', 'is_active' => true]
        );
        Semester::updateOrCreate(
            ['academic_year_id' => $year->id, 'name' => 'الفصل الأول'],
            ['is_active' => true]
        );
        Semester::updateOrCreate(
            ['academic_year_id' => $year->id, 'name' => 'الفصل الثاني'],
            ['is_active' => false]
        );
    }
}
