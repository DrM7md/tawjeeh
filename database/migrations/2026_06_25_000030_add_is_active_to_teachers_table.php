<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * حالة المعلم (نشط/غير نشط) لدعم مزامنة الاستيراد:
     * المعلم الذي يختفي من ملف مدرسته يصبح غير نشط (لا يُحذف)،
     * وإن انتقل لمدرسة أخرى يُفعَّل سجله هناك ويبقى غير نشط في القديمة.
     */
    public function up(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('email');

            // فهرس لتصفية النشطين بسرعة ضمن (العام/المدرسة/القسم)
            $table->index(['academic_year_id', 'school_id', 'department_id', 'is_active'], 'teachers_year_school_dept_active_idx');
        });
    }

    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropIndex('teachers_year_school_dept_active_idx');
            $table->dropColumn('is_active');
        });
    }
};
