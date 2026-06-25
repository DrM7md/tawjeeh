<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\Department;
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

        // تصنيفات المعلمين
        $classifications = [
            ['name' => 'يحتاج دعم', 'code' => 'needs_support', 'required_visits' => 3, 'color' => '#FF3B30'],
            ['name' => 'متوسط', 'code' => 'average', 'required_visits' => 2, 'color' => '#FF9F0A'],
            ['name' => 'متميز', 'code' => 'distinguished', 'required_visits' => 1, 'color' => '#34C759'],
        ];
        foreach ($classifications as $c) {
            TeacherClassification::updateOrCreate(['code' => $c['code']], $c);
        }

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
            ['start_date' => '2026-08-01', 'end_date' => '2027-06-30', 'is_active' => true, 'status' => 'active']
        );
        Semester::updateOrCreate(
            ['academic_year_id' => $year->id, 'name' => 'الفصل الأول'],
            ['is_active' => true, 'status' => 'active']
        );
        Semester::updateOrCreate(
            ['academic_year_id' => $year->id, 'name' => 'الفصل الثاني'],
            ['is_active' => false, 'status' => 'not_started']
        );
    }
}
