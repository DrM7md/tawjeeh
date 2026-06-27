<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * حقول الملف الوظيفي للمعلم (تُستورد عبر قالب القسم).
     * النصاب (quota) يُحسب لاحقًا من صفحة الأنصبة — يبقى فارغًا عند الاستيراد.
     */
    public function up(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->string('employee_no')->nullable()->after('name');        // الرقم الوظيفي
            $table->string('national_id')->nullable()->after('employee_no'); // الرقم الشخصي (مفتاح التمييز)
            $table->enum('gender', ['male', 'female'])->nullable()->after('national_id'); // الجنس
            $table->string('nationality')->nullable()->after('gender');      // الجنسية
            $table->date('birth_date')->nullable()->after('nationality');    // تاريخ الميلاد
            $table->string('job_title')->nullable()->after('birth_date');    // المسمى الوظيفي (معلم/منسق)
            $table->string('academic_degree')->nullable()->after('job_title'); // الدرجة العلمية
            $table->string('specialization')->nullable()->after('academic_degree'); // التخصص العلمي
            $table->date('ministry_hire_date')->nullable()->after('specialization'); // تاريخ التعيين في الوزارة
            $table->string('license_level')->nullable()->after('ministry_hire_date'); // مستوى الرخصة المهنية
            $table->string('license_year')->nullable()->after('license_level'); // سنة الحصول على الرخصة
            $table->string('residential_zone')->nullable()->after('license_year'); // المنطقة السكنية
            $table->unsignedSmallInteger('quota')->nullable()->after('sections_count'); // النصاب (محسوب لاحقًا)

            $table->index(['academic_year_id', 'department_id', 'national_id'], 'teachers_year_dept_national_idx');
        });
    }

    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropIndex('teachers_year_dept_national_idx');
            $table->dropColumn([
                'employee_no', 'national_id', 'gender', 'nationality', 'birth_date',
                'job_title', 'academic_degree', 'specialization', 'ministry_hire_date',
                'license_level', 'license_year', 'residential_zone', 'quota',
            ]);
        });
    }
};
