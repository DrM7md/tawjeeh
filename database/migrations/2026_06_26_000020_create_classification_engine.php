<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * محرك التصنيف (القسم 1.1 من الدليل):
 * - توسعة teacher_classifications لتصبح «قاعدة التصنيف»: حدود النِسَب + عدد الاستمارات + التصنيف الافتراضي للجديد.
 * - classification_records: سجلّ التصنيف المرحلي (مبدئي/منتصف/نهائي) لكل معلم مع الأساس والدرجة والاعتماد.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teacher_classifications', function (Blueprint $table) {
            $table->unsignedTinyInteger('min_percent')->nullable()->after('required_visits'); // حدّ أدنى للنسبة (شامل)
            $table->unsignedTinyInteger('max_percent')->nullable()->after('min_percent');     // حدّ أعلى للنسبة (شامل)
            $table->unsignedTinyInteger('required_forms')->default(1)->after('max_percent');   // عدد الاستمارات المطلوبة لكل فصل
            $table->boolean('is_default_for_new')->default(false)->after('required_forms');     // فئة المعلم الجديد آليًا
            $table->unsignedInteger('sort_order')->default(0)->after('is_default_for_new');
        });

        Schema::create('classification_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('semester_id')->nullable()->constrained('semesters')->nullOnDelete();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('teacher_classification_id')->constrained('teacher_classifications')->cascadeOnDelete();
            $table->string('stage');                              // initial | midyear | final
            $table->string('basis');                              // annual_eval | supervisor_observation
            $table->decimal('score', 5, 2)->nullable();           // التقدير المئوي (مصدر التصنيف)
            $table->string('status')->default('draft');           // draft | approved
            $table->string('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            // سجلّ واحد لكل معلم في كل مرحلة من مراحل العام.
            $table->unique(['teacher_id', 'academic_year_id', 'stage']);
            $table->index(['academic_year_id', 'stage', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classification_records');
        Schema::table('teacher_classifications', function (Blueprint $table) {
            $table->dropColumn(['min_percent', 'max_percent', 'required_forms', 'is_default_for_new', 'sort_order']);
        });
    }
};
